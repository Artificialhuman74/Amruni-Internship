"""Minimal pure-Python PDF 1.4 generator for clinical documents with clickable URI links."""
import textwrap

_PAGE_WIDTH = 595
_PAGE_HEIGHT = 842
_MARGIN_X = 48
_TOP_Y = 786
_BOTTOM_Y = 64
_CONTENT_W = _PAGE_WIDTH - 2 * _MARGIN_X

_CHAR_REPLACEMENTS = {
    "\u20b9": "Rs. ",
    "\u2014": "-",
    "\u2013": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2026": "...",
    "\u00b7": " | ",
    "\u211e": "Rx",
}


def _pdf_literal(text: str) -> bytes:
    cleaned = text or ""
    for src, dst in _CHAR_REPLACEMENTS.items():
        cleaned = cleaned.replace(src, dst)
    cleaned = cleaned.replace("\r", " ").replace("\n", " ")
    raw = cleaned.encode("latin-1", errors="replace")
    return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


class _PdfDoc:
    def __init__(self):
        self._pages: list[tuple[list[bytes], list[tuple[int, int, int, int, str]]]] = []
        self._new_page()

    def _new_page(self) -> None:
        self._cmds: list[bytes] = []
        self._annots: list[tuple[int, int, int, int, str]] = []
        self._pages.append((self._cmds, self._annots))
        self.y = _TOP_Y

    def _ensure_space(self, needed: int) -> None:
        if self.y - needed < _BOTTOM_Y:
            self._new_page()

    def text_line(self, text: str, size: int = 10, bold: bool = False, leading: int | None = None, x: int = _MARGIN_X) -> None:
        step = leading or (size + 5)
        self._ensure_space(step)
        font = b"/F2" if bold else b"/F1"
        self._cmds.append(
            b"BT " + font + f" {size} Tf 1 0 0 1 {x} {self.y} Tm (".encode("ascii")
            + _pdf_literal(text)
            + b") Tj ET"
        )
        self.y -= step

    def wrapped(self, text: str, size: int = 10, bold: bool = False, width: int = 84, x: int = _MARGIN_X) -> None:
        for para in (text or "").splitlines() or [""]:
            chunks = textwrap.wrap(para, width=width, break_long_words=True, break_on_hyphens=False) or [""]
            for line in chunks:
                self.text_line(line, size=size, bold=bold, x=x)

    def spacer(self, pts: int = 8) -> None:
        self.y -= pts
        if self.y < _BOTTOM_Y:
            self._new_page()

    def rule(self) -> None:
        self._ensure_space(12)
        self._cmds.append(f"0.6 w 0.72 0.72 0.72 RG {_MARGIN_X} {self.y} m {_PAGE_WIDTH - _MARGIN_X} {self.y} l S 0 0 0 RG".encode("ascii"))
        self.y -= 14

    def link_url(self, url: str) -> None:
        chunks = textwrap.wrap(url, width=96, break_long_words=True, break_on_hyphens=False) or [url]
        top = self.y + 10
        for chunk in chunks:
            self.text_line(chunk, size=8, bold=False, leading=11)
        bottom = max(_BOTTOM_Y - 8, self.y + 8)
        self._annots.append((_MARGIN_X, bottom, _MARGIN_X + _CONTENT_W, top, url))

    def to_bytes(self) -> bytes:
        objects: dict[int, bytes] = {
            1: b"<< /Type /Catalog /Pages 2 0 R >>",
            3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            4: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        }
        page_ids: list[int] = []
        next_id = 5

        for cmds, annots in self._pages:
            stream = b"\n".join(cmds)
            stream_id = next_id
            next_id += 1
            objects[stream_id] = (
                f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"\nendstream"
            )

            annot_ids: list[int] = []
            for x1, y1, x2, y2, uri in annots:
                aid = next_id
                next_id += 1
                objects[aid] = (
                    f"<< /Type /Annot /Subtype /Link /Rect [{x1} {y1} {x2} {y2}] /Border [0 0 0] "
                    f"/A << /S /URI /URI (".encode("ascii")
                    + _pdf_literal(uri)
                    + b") >> >>"
                )
                annot_ids.append(aid)

            page_id = next_id
            next_id += 1
            annots_entry = f" /Annots [{' '.join(f'{i} 0 R' for i in annot_ids)}]" if annot_ids else ""
            objects[page_id] = (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {_PAGE_WIDTH} {_PAGE_HEIGHT}] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {stream_id} 0 R{annots_entry} >>"
            ).encode("ascii")
            page_ids.append(page_id)

        objects[2] = f"<< /Type /Pages /Kids [{' '.join(f'{i} 0 R' for i in page_ids)}] /Count {len(page_ids)} >>".encode("ascii")

        total = max(objects)
        buf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets: dict[int, int] = {}
        for obj_id in range(1, total + 1):
            offsets[obj_id] = len(buf)
            buf.extend(f"{obj_id} 0 obj\n".encode("ascii"))
            buf.extend(objects[obj_id])
            buf.extend(b"\nendobj\n")

        xref_offset = len(buf)
        buf.extend(f"xref\n0 {total + 1}\n0000000000 65535 f \n".encode("ascii"))
        for obj_id in range(1, total + 1):
            buf.extend(f"{offsets[obj_id]:010d} 00000 n \n".encode("ascii"))
        buf.extend(
            f"trailer\n<< /Size {total + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
        )
        return bytes(buf)


def build_prescription_pdf(
    *,
    rx_id: str,
    consultation_date: str,
    consultation_time: str,
    issued_at: str,
    doctor_name: str,
    doctor_specialty: str,
    doctor_registration: str | None,
    patient_name: str,
    diagnosis: str | None,
    medicines: list[dict],
    follow_up: str | None,
    notes: str | None,
    verification_url: str,
) -> bytes:
    """Render a valid downloadable prescription PDF with an embedded verification URL."""
    doc = _PdfDoc()
    doc.text_line("AMRUNI TELEMEDICINE", size=14, bold=True)
    doc.text_line("PRESCRIPTION SUMMARY", size=10, bold=True)
    doc.spacer(4)
    doc.rule()

    when = " ".join(part for part in (consultation_date, consultation_time) if part) or "-"
    doc.text_line(f"Rx ID: {rx_id}", size=10, bold=True)
    doc.text_line(f"Consultation Date: {when}")
    doc.text_line(f"Issued: {issued_at}")
    doc.spacer(6)

    doc.text_line(f"Practitioner: {doctor_name}" + (f" ({doctor_specialty})" if doctor_specialty else ""), bold=True)
    doc.text_line(f"Registration: {doctor_registration or 'On file - verify via link below'}")
    doc.text_line(f"Patient: {patient_name or 'Confidential Patient'}")
    doc.spacer(6)
    doc.rule()

    if diagnosis:
        doc.text_line("Diagnosis", size=11, bold=True)
        doc.wrapped(diagnosis, width=84)
        doc.spacer(6)

    doc.text_line("Prescribed Medicines (Rx)", size=11, bold=True)
    if medicines:
        for idx, item in enumerate(medicines, start=1):
            details = [str(item.get(k) or "").strip() for k in ("dose", "frequency", "duration")]
            detail_str = ", ".join(d for d in details if d)
            name = str(item.get("name") or "").strip()
            line = f"{idx}. {name}" + (f" - {detail_str}" if detail_str else "")
            doc.wrapped(line, width=82)
    else:
        doc.text_line("No medicines prescribed for this visit.")
    doc.spacer(6)

    if follow_up:
        doc.text_line(f"Follow-up Advised: {follow_up}", bold=True)
        doc.spacer(4)

    if notes:
        doc.text_line("Clinical Instructions / Notes", size=11, bold=True)
        doc.wrapped(notes, width=84)
        doc.spacer(6)

    doc.rule()
    doc.text_line("Verify Prescription Authenticity", size=10, bold=True)
    doc.text_line("Issued from the clinician's consultation record. Verify live status at:", size=9)
    doc.link_url(verification_url)
    return doc.to_bytes()
