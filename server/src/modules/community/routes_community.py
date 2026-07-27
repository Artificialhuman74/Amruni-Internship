"""Private journal + anonymous community (Flo "Secret Chats"-style threads).

Identity model: every post/reply carries `isAnonymous`. When true, the author
is shown by their stable per-user anon handle instead of their real name.
`author_id` never leaves this module in a JSON response — clients only ever
see a display name, never a resolvable user id, so an "anonymous" post stays
anonymous even to other clients inspecting network traffic.
"""
import json
import random
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.auth import current_user
from ...database.db import get_db, new_id, utcnow_iso

router = APIRouter()

# ---------- tags ----------

TAGS = [
    {"id": "menstruation", "label": "Menstruation"},
    {"id": "sex-pleasure", "label": "Sex & pleasure", "restricted": True},
    {"id": "taboo", "label": "Taboo topics", "restricted": True},
    {"id": "pcos-hormones", "label": "PCOS & hormones"},
    {"id": "mental-health", "label": "Mental health & feelings"},
    {"id": "relationships", "label": "Relationships"},
    {"id": "pregnancy-postpartum", "label": "Pregnancy & postpartum"},
    {"id": "body-image", "label": "Body image & self-care"},
    {"id": "random", "label": "Random / off-topic"},
]
RESTRICTED_TAG_IDS = {t["id"] for t in TAGS if t.get("restricted")}


def tags_for_life_stage(life_stage: str) -> list[dict]:
    if life_stage == "adolescent":
        return [t for t in TAGS if t["id"] not in RESTRICTED_TAG_IDS]
    return TAGS


def validate_tags(tags: list[str], life_stage: str):
    known = {t["id"] for t in TAGS}
    for tag in tags:
        if tag not in known:
            raise HTTPException(400, f"Unknown tag: {tag}")
    if life_stage == "adolescent" and any(t in RESTRICTED_TAG_IDS for t in tags):
        raise HTTPException(403, "That tag isn't available on this account.")


# ---------- moderation ----------

BLOCKED_TERMS = (
    "kill myself", "end my life", "suicide method", "how to hurt myself",
)
REPORT_AUTO_HIDE_THRESHOLD = 3


def moderate_text(text: str | None) -> str:
    lowered = (text or "").lower()
    if any(term in lowered for term in BLOCKED_TERMS):
        return "rejected"
    return "approved"


# ---------- anon handles ----------

_ADJECTIVES = ["Violet", "Amber", "Quiet", "Coral", "Golden", "Misty", "Rosy", "Sage",
               "Silver", "Dusky", "Sunny", "Gentle", "Warm", "Soft", "Bright"]
_NOUNS = ["Harbor", "Meadow", "River", "Bloom", "Orbit", "Wren", "Ember", "Grove",
          "Tide", "Petal", "Comet", "Willow", "Nest", "Ridge", "Dawn"]


def get_or_create_anon_handle(db: sqlite3.Connection, user_id: int) -> str:
    row = db.execute("SELECT handle FROM anon_handles WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        return row["handle"]
    for _ in range(20):
        handle = f"{random.choice(_ADJECTIVES)}{random.choice(_NOUNS)}{random.randint(10, 999)}"
        try:
            db.execute("INSERT INTO anon_handles (user_id, handle) VALUES (?, ?)", (user_id, handle))
            return handle
        except sqlite3.IntegrityError:
            continue
    raise HTTPException(500, "Could not allocate an anonymous handle. Try again.")


# ---------- serialization ----------

def _poll_tallies(db: sqlite3.Connection, post_id: str, options: list[str]) -> list[dict]:
    counts = {i: 0 for i in range(len(options))}
    for row in db.execute(
        "SELECT option_index, COUNT(*) AS n FROM community_poll_votes WHERE post_id = ? GROUP BY option_index",
        (post_id,),
    ).fetchall():
        if row["option_index"] in counts:
            counts[row["option_index"]] = row["n"]
    return [{"label": label, "votes": counts[i]} for i, label in enumerate(options)]


def _post_json(db: sqlite3.Connection, row, viewer_id: int) -> dict:
    display_name = get_or_create_anon_handle(db, row["author_id"]) if row["is_anonymous"] else None
    if not row["is_anonymous"]:
        user = db.execute("SELECT name FROM users WHERE id = ?", (row["author_id"],)).fetchone()
        display_name = (user["name"] if user and user["name"] else "A member")

    liked = db.execute(
        "SELECT 1 FROM community_likes WHERE user_id = ? AND post_id = ?", (viewer_id, row["id"])
    ).fetchone() is not None

    poll = None
    my_vote = None
    if row["type"] == "poll":
        options = json.loads(row["poll_options"] or "[]")
        poll = _poll_tallies(db, row["id"], options)
        vote_row = db.execute(
            "SELECT option_index FROM community_poll_votes WHERE user_id = ? AND post_id = ?",
            (viewer_id, row["id"]),
        ).fetchone()
        my_vote = vote_row["option_index"] if vote_row else None

    return {
        "id": row["id"],
        "displayName": display_name,
        "isAnonymous": bool(row["is_anonymous"]),
        "isMine": row["author_id"] == viewer_id,
        "tags": json.loads(row["tags"] or "[]"),
        "type": row["type"],
        "text": row["text"],
        "poll": poll,
        "myVote": my_vote,
        "replyToId": row["reply_to_id"],
        "likeCount": row["like_count"],
        "likedByMe": liked,
        "replyCount": row["reply_count"],
        "createdAt": row["created_at"],
    }


def _visible_posts_clause(db: sqlite3.Connection, viewer_id: int, life_stage: str) -> tuple[str, list]:
    blocked = [r["blocked_id"] for r in db.execute(
        "SELECT blocked_id FROM community_blocks WHERE user_id = ?", (viewer_id,)
    ).fetchall()]
    clause = "moderation_status = 'approved'"
    params: list = []
    if blocked:
        placeholders = ",".join("?" for _ in blocked)
        clause += f" AND author_id NOT IN ({placeholders})"
        params.extend(blocked)
    return clause, params


def _filter_restricted_for_viewer(posts: list[dict], life_stage: str) -> list[dict]:
    if life_stage != "adolescent":
        return posts
    return [p for p in posts if not any(t in RESTRICTED_TAG_IDS for t in p["tags"])]


# ---------- journal ----------

class JournalBody(BaseModel):
    date: str
    text: str
    tags: list[str] = []
    moodLogId: str | None = None
    context: dict = {}
    bringToAppointment: bool = False


def _journal_json(row, mood: dict | None = None) -> dict:
    return {
        "id": row["id"],
        "date": row["date"],
        "text": row["text"],
        "tags": json.loads(row["tags"] or "[]"),
        "sharedAsPostId": row["shared_as_post_id"],
        "moodLogId": row["mood_log_id"],
        "mood": mood,
        "context": json.loads(row["context"] or "{}"),
        "bringToAppointment": bool(row["bring_to_appointment"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _moods_for(db, rows) -> dict[str, dict]:
    ids = [r["mood_log_id"] for r in rows if r["mood_log_id"]]
    if not ids:
        return {}
    placeholders = ",".join("?" * len(ids))
    moods = db.execute(
        f"SELECT * FROM mood_logs WHERE id IN ({placeholders})", ids
    ).fetchall()
    return {
        m["id"]: {
            "id": m["id"],
            "valence": m["valence"],
            "word": m["word"],
            "factors": json.loads(m["factors"] or "[]"),
            "scope": m["scope"],
            "loggedAt": m["logged_at"],
        }
        for m in moods
    }


@router.get("/journal")
def list_journal(user: dict = Depends(current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC, created_at DESC", (user["id"],)
        ).fetchall()
        moods = _moods_for(db, rows)
    return [_journal_json(r, moods.get(r["mood_log_id"])) for r in rows]


@router.post("/journal", status_code=201)
def create_journal(body: JournalBody, user: dict = Depends(current_user)):
    entry_id = new_id("journal")
    now = utcnow_iso()
    with get_db() as db:
        validate_tags(body.tags, user["life_stage"])
        db.execute(
            """INSERT INTO journal_entries
                 (id, user_id, date, text, tags, mood_log_id, context, bring_to_appointment, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (entry_id, user["id"], body.date, body.text, json.dumps(body.tags),
             body.moodLogId, json.dumps(body.context), int(body.bringToAppointment), now, now),
        )
        if body.moodLogId:
            db.execute(
                "UPDATE mood_logs SET journal_id = ? WHERE id = ? AND user_id = ?",
                (entry_id, body.moodLogId, user["id"]),
            )
        row = db.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        moods = _moods_for(db, [row])
    return _journal_json(row, moods.get(row["mood_log_id"]))


@router.patch("/journal/{entry_id}")
def update_journal(entry_id: str, body: JournalBody, user: dict = Depends(current_user)):
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM journal_entries WHERE id = ? AND user_id = ?", (entry_id, user["id"])
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Journal entry not found.")
        validate_tags(body.tags, user["life_stage"])
        db.execute(
            """UPDATE journal_entries
                 SET date = ?, text = ?, tags = ?, mood_log_id = ?, context = ?,
                     bring_to_appointment = ?, updated_at = ?
               WHERE id = ?""",
            (body.date, body.text, json.dumps(body.tags), body.moodLogId,
             json.dumps(body.context) if body.context else existing["context"],
             int(body.bringToAppointment), utcnow_iso(), entry_id),
        )
        if body.moodLogId:
            db.execute(
                "UPDATE mood_logs SET journal_id = ? WHERE id = ? AND user_id = ?",
                (entry_id, body.moodLogId, user["id"]),
            )
        row = db.execute("SELECT * FROM journal_entries WHERE id = ?", (entry_id,)).fetchone()
        moods = _moods_for(db, [row])
    return _journal_json(row, moods.get(row["mood_log_id"]))


@router.delete("/journal/{entry_id}")
def delete_journal(entry_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM journal_entries WHERE id = ? AND user_id = ?", (entry_id, user["id"])
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Journal entry not found.")
        if existing["mood_log_id"]:
            db.execute(
                "DELETE FROM mood_logs WHERE id = ? AND user_id = ? AND source = 'journal' AND scope = 'moment'",
                (existing["mood_log_id"], user["id"]),
            )
        db.execute("DELETE FROM journal_entries WHERE id = ?", (entry_id,))
    return {"success": True}


class ShareJournalBody(BaseModel):
    isAnonymous: bool = True


@router.post("/journal/{entry_id}/share", status_code=201)
def share_journal(entry_id: str, body: ShareJournalBody, user: dict = Depends(current_user)):
    post_id = new_id("post")
    now = utcnow_iso()
    with get_db() as db:
        entry = db.execute(
            "SELECT * FROM journal_entries WHERE id = ? AND user_id = ?", (entry_id, user["id"])
        ).fetchone()
        if not entry:
            raise HTTPException(404, "Journal entry not found.")
        tags = json.loads(entry["tags"] or "[]")
        validate_tags(tags, user["life_stage"])
        status = moderate_text(entry["text"])
        db.execute(
            """INSERT INTO community_posts
                 (id, author_id, is_anonymous, tags, type, text, reply_to_id, moderation_status, created_at)
               VALUES (?, ?, ?, ?, 'text', ?, NULL, ?, ?)""",
            (post_id, user["id"], int(body.isAnonymous), json.dumps(tags), entry["text"], status, now),
        )
        db.execute("UPDATE journal_entries SET shared_as_post_id = ? WHERE id = ?", (post_id, entry_id))
        row = db.execute("SELECT * FROM community_posts WHERE id = ?", (post_id,)).fetchone()
        post = _post_json(db, row, user["id"])
    return post


# ---------- community ----------

@router.get("/community/tags")
def get_tags(user: dict = Depends(current_user)):
    return tags_for_life_stage(user["life_stage"])


@router.get("/community/feed")
def get_feed(tag: str | None = None, before: str | None = None, limit: int = 20, user: dict = Depends(current_user)):
    limit = max(1, min(limit, 50))
    with get_db() as db:
        clause, params = _visible_posts_clause(db, user["id"], user["life_stage"])
        sql = f"SELECT * FROM community_posts WHERE reply_to_id IS NULL AND {clause}"
        if before:
            sql += " AND created_at < ?"
            params.append(before)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        rows = db.execute(sql, params).fetchall()
        posts = [_post_json(db, r, user["id"]) for r in rows]
    posts = _filter_restricted_for_viewer(posts, user["life_stage"])
    return {"posts": posts, "nextBefore": posts[-1]["createdAt"] if len(posts) == limit else None}


@router.get("/community/posts/{post_id}")
def get_post(post_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM community_posts WHERE id = ?", (post_id,)).fetchone()
        if not row or row["moderation_status"] != "approved":
            raise HTTPException(404, "Post not found.")
        post = _post_json(db, row, user["id"])
        if user["life_stage"] == "adolescent" and any(t in RESTRICTED_TAG_IDS for t in post["tags"]):
            raise HTTPException(404, "Post not found.")

        clause, params = _visible_posts_clause(db, user["id"], user["life_stage"])
        reply_rows = db.execute(
            f"SELECT * FROM community_posts WHERE reply_to_id = ? AND {clause} ORDER BY created_at DESC",
            [post_id, *params],
        ).fetchall()
        replies = [_post_json(db, r, user["id"]) for r in reply_rows]
    return {"post": post, "replies": replies}


class CreatePostBody(BaseModel):
    tags: list[str] = []
    type: str = "text"
    text: str | None = None
    pollOptions: list[str] = []
    isAnonymous: bool = True
    replyToId: str | None = None


@router.post("/community/posts", status_code=201)
def create_post(body: CreatePostBody, user: dict = Depends(current_user)):
    if body.type not in ("text", "poll"):
        raise HTTPException(400, "type must be 'text' or 'poll'.")
    if body.type == "poll" and body.replyToId:
        raise HTTPException(400, "Polls can only be root posts, not replies.")
    if body.type == "text" and not (body.text or "").strip():
        raise HTTPException(400, "Post text is required.")
    if body.type == "poll":
        if not (body.text or "").strip():
            raise HTTPException(400, "A poll needs a question.")
        if not (2 <= len(body.pollOptions) <= 4):
            raise HTTPException(400, "A poll needs 2 to 4 options.")

    post_id = new_id("post")
    now = utcnow_iso()
    with get_db() as db:
        validate_tags(body.tags, user["life_stage"])
        if body.replyToId:
            parent = db.execute("SELECT id FROM community_posts WHERE id = ?", (body.replyToId,)).fetchone()
            if not parent:
                raise HTTPException(404, "The post you're replying to no longer exists.")
        status = moderate_text(body.text if body.type == "text" else " ".join([body.text or "", *body.pollOptions]))
        db.execute(
            """INSERT INTO community_posts
                 (id, author_id, is_anonymous, tags, type, text, poll_options, reply_to_id, moderation_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (post_id, user["id"], int(body.isAnonymous), json.dumps(body.tags), body.type, body.text,
             json.dumps(body.pollOptions) if body.type == "poll" else None,
             body.replyToId, status, now),
        )
        if body.replyToId:
            db.execute("UPDATE community_posts SET reply_count = reply_count + 1 WHERE id = ?", (body.replyToId,))
        row = db.execute("SELECT * FROM community_posts WHERE id = ?", (post_id,)).fetchone()
        post = _post_json(db, row, user["id"])
    return post


@router.post("/community/posts/{post_id}/like")
def toggle_like(post_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        post = db.execute("SELECT id FROM community_posts WHERE id = ?", (post_id,)).fetchone()
        if not post:
            raise HTTPException(404, "Post not found.")
        liked = db.execute(
            "SELECT 1 FROM community_likes WHERE user_id = ? AND post_id = ?", (user["id"], post_id)
        ).fetchone()
        if liked:
            db.execute("DELETE FROM community_likes WHERE user_id = ? AND post_id = ?", (user["id"], post_id))
            db.execute("UPDATE community_posts SET like_count = MAX(0, like_count - 1) WHERE id = ?", (post_id,))
        else:
            db.execute("INSERT INTO community_likes (user_id, post_id) VALUES (?, ?)", (user["id"], post_id))
            db.execute("UPDATE community_posts SET like_count = like_count + 1 WHERE id = ?", (post_id,))
        row = db.execute("SELECT like_count FROM community_posts WHERE id = ?", (post_id,)).fetchone()
    return {"likeCount": row["like_count"], "likedByMe": not liked}


class VoteBody(BaseModel):
    optionIndex: int


@router.post("/community/posts/{post_id}/vote")
def vote_poll(post_id: str, body: VoteBody, user: dict = Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM community_posts WHERE id = ?", (post_id,)).fetchone()
        if not row or row["type"] != "poll":
            raise HTTPException(404, "Poll not found.")
        options = json.loads(row["poll_options"] or "[]")
        if not (0 <= body.optionIndex < len(options)):
            raise HTTPException(400, "Invalid option.")
        db.execute(
            """INSERT INTO community_poll_votes (user_id, post_id, option_index) VALUES (?, ?, ?)
               ON CONFLICT(user_id, post_id) DO UPDATE SET option_index = excluded.option_index""",
            (user["id"], post_id, body.optionIndex),
        )
        tallies = _poll_tallies(db, post_id, options)
    return {"poll": tallies, "myVote": body.optionIndex}


class ReportBody(BaseModel):
    reason: str | None = None


@router.post("/community/posts/{post_id}/report", status_code=201)
def report_post(post_id: str, body: ReportBody, user: dict = Depends(current_user)):
    with get_db() as db:
        post = db.execute("SELECT id FROM community_posts WHERE id = ?", (post_id,)).fetchone()
        if not post:
            raise HTTPException(404, "Post not found.")
        db.execute(
            "INSERT INTO community_reports (post_id, reporter_id, reason) VALUES (?, ?, ?)",
            (post_id, user["id"], body.reason),
        )
        count = db.execute(
            "SELECT COUNT(*) AS n FROM community_reports WHERE post_id = ?", (post_id,)
        ).fetchone()["n"]
        if count >= REPORT_AUTO_HIDE_THRESHOLD:
            db.execute("UPDATE community_posts SET moderation_status = 'rejected' WHERE id = ?", (post_id,))
    return {"success": True}


@router.post("/community/posts/{post_id}/block-author")
def block_author(post_id: str, user: dict = Depends(current_user)):
    with get_db() as db:
        post = db.execute("SELECT author_id FROM community_posts WHERE id = ?", (post_id,)).fetchone()
        if not post:
            raise HTTPException(404, "Post not found.")
        if post["author_id"] == user["id"]:
            raise HTTPException(400, "You can't block yourself.")
        db.execute(
            "INSERT OR IGNORE INTO community_blocks (user_id, blocked_id) VALUES (?, ?)",
            (user["id"], post["author_id"]),
        )
    return {"success": True}
