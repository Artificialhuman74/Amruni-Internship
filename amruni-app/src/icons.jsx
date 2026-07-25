/*
  Amruni icon system
  ──────────────────
  One vocabulary for the whole product. Every icon speaks the same language:
  a 1.75 stroke on the 24-grid, `currentColor`, rounded joins — the quiet,
  precise line of a senior specialist's chart, never a sticker sheet.

  Icons are named by *role* (IconAppointment), not by shape (IconCalendar),
  so the meaning lives in one place and a future redraw never touches a screen.
  The brand's own marks — the camellia, the pregnant figure, the tricolour —
  are drawn by hand below so they carry Amruni's intent, not a generic set's.

  Base line-work comes from Lucide (ISC), tuned once here.
*/
import { forwardRef } from 'react';
import {
  Search, Video, MessageCircle, Phone, Globe, Settings, LogOut,
  TriangleAlert, Check, CircleCheck, Plus, X, Bell, Lock, ShieldCheck,
  Star, Heart, HeartPulse, Send, ClipboardList, Hospital, Stethoscope,
  Calendar, NotebookPen, BookOpen, FileText, FlaskConical, Scan, Paperclip,
  TrendingUp, Link2, Briefcase, Lightbulb, Trash2, User, Smartphone, Siren,
  Footprints, Hand, Pill, Leaf, Brain, Waves, HeartHandshake, Scale, Moon,
  MoonStar, BedDouble, Sprout, Flower2, Flower, Baby, House, Smile, Frown,
  Flame, Wind, Bandage, BatteryLow, CircleDot, Cookie, CloudRain, Droplet,
  Sparkles, Bone,
} from 'lucide-react';

/* One knob for the whole set: absolute 1.75 stroke, 20px default, decorative
   by default. Any call can override size, color, strokeWidth, or aria-label. */
const line = (Base, name) => {
  const Icon = forwardRef(function Icon(props, ref) {
    return (
      <Base
        ref={ref}
        size={20}
        strokeWidth={1.75}
        absoluteStrokeWidth
        aria-hidden="true"
        {...props}
      />
    );
  });
  Icon.displayName = name;
  return Icon;
};

/* ── Actions & wayfinding ─────────────────────────────────────────── */
export const IconSearch = line(Search, 'IconSearch');
export const IconVideo = line(Video, 'IconVideo');
export const IconChat = line(MessageCircle, 'IconChat');
export const IconPhone = line(Phone, 'IconPhone');
export const IconMobile = line(Smartphone, 'IconMobile');
export const IconLanguage = line(Globe, 'IconLanguage');
export const IconSettings = line(Settings, 'IconSettings');
export const IconLogout = line(LogOut, 'IconLogout');
export const IconAlert = line(TriangleAlert, 'IconAlert');
export const IconCheck = line(Check, 'IconCheck');
export const IconCheckCircle = line(CircleCheck, 'IconCheckCircle');
export const IconPlus = line(Plus, 'IconPlus');
export const IconClose = line(X, 'IconClose');
export const IconBell = line(Bell, 'IconBell');
export const IconLock = line(Lock, 'IconLock');
export const IconShield = line(ShieldCheck, 'IconShield');
export const IconSend = line(Send, 'IconSend');
export const IconLink = line(Link2, 'IconLink');
export const IconTip = line(Lightbulb, 'IconTip');
export const IconTrash = line(Trash2, 'IconTrash');
export const IconStar = line(Star, 'IconStar');
export const IconHeart = line(Heart, 'IconHeart');
export const IconPulse = line(HeartPulse, 'IconPulse');
export const IconWave = line(Hand, 'IconWave');
export const IconUser = line(User, 'IconUser');
export const IconBriefcase = line(Briefcase, 'IconBriefcase');
export const IconTrend = line(TrendingUp, 'IconTrend');

/* ── Care, records & clinical ─────────────────────────────────────── */
export const IconStethoscope = line(Stethoscope, 'IconStethoscope');
export const IconHospital = line(Hospital, 'IconHospital');
export const IconAppointment = line(Calendar, 'IconAppointment');
export const IconRecords = line(ClipboardList, 'IconRecords');
export const IconPrescription = line(FileText, 'IconPrescription');
export const IconJournal = line(NotebookPen, 'IconJournal');
export const IconGuide = line(BookOpen, 'IconGuide');
export const IconLab = line(FlaskConical, 'IconLab');
export const IconReport = line(FileText, 'IconReport');
export const IconScan = line(Scan, 'IconScan');
export const IconAttachment = line(Paperclip, 'IconAttachment');
export const IconPill = line(Pill, 'IconPill');
export const IconSOS = line(Siren, 'IconSOS');

/* ── Wellbeing, cycle & life-stage metaphor ───────────────────────── */
export const IconBrain = line(Brain, 'IconBrain');
export const IconMind = line(Waves, 'IconMind');
export const IconWellness = line(HeartHandshake, 'IconWellness');
export const IconWeight = line(Scale, 'IconWeight');
export const IconCycle = line(Moon, 'IconCycle');
export const IconSleep = line(BedDouble, 'IconSleep');
export const IconInsomnia = line(MoonStar, 'IconInsomnia');
export const IconSprout = line(Sprout, 'IconSprout');
export const IconLeaf = line(Leaf, 'IconLeaf');
export const IconBlossom = line(Flower2, 'IconBlossom');
export const IconDaisy = line(Flower, 'IconDaisy');
export const IconBaby = line(Baby, 'IconBaby');
export const IconHome = line(House, 'IconHome');
export const IconFootprints = line(Footprints, 'IconFootprints');
export const IconMood = line(Smile, 'IconMood');
export const IconSparkles = line(Sparkles, 'IconSparkles');
export const IconDroplet = line(Droplet, 'IconDroplet');

/* ── Symptom chips ────────────────────────────────────────────────── */
export const IconCramps = line(Flame, 'IconCramps');
export const IconBloating = line(Wind, 'IconBloating');
export const IconHeadache = line(Bandage, 'IconHeadache');
export const IconFatigue = line(BatteryLow, 'IconFatigue');
export const IconAcne = line(CircleDot, 'IconAcne');
export const IconNausea = line(Frown, 'IconNausea');
export const IconCraving = line(Cookie, 'IconCraving');
export const IconAnxiety = line(CloudRain, 'IconAnxiety');
export const IconBackPain = line(Bone, 'IconBackPain');

/* ─────────────────────────────────────────────────────────────────────
   Bespoke marks — drawn for Amruni, not borrowed.
   ───────────────────────────────────────────────────────────────────── */

/*
  Camellia — the brand flower. Five petals around a gold-hearted centre,
  the same geometry as the logotype but drawn in line so it inherits text
  colour. Stands for menopause in the life-stage map and for Amruni itself.
*/
export const IconCamellia = forwardRef(function IconCamellia(
  { size = 20, strokeWidth = 1.6, heart = 'currentColor', ...rest },
  ref,
) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {petals.map((deg) => (
        <ellipse key={deg} cx="12" cy="6.4" rx="3" ry="5.1" transform={`rotate(${deg} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="2.4" fill={heart} stroke="none" />
    </svg>
  );
});

/*
  Pregnancy — a soft filled heart in the pregnancy rose. Stands in for the
  life stage everywhere the pregnancy mode surfaces. Colour defaults to the
  pregnancy hue and can be overridden per context.
*/
export const IconPregnant = forwardRef(function IconPregnant(
  { size = 20, color = 'var(--clr-preg)', ...rest },
  ref,
) {
  return (
    <Heart
      ref={ref}
      size={size}
      color={color}
      fill={color}
      strokeWidth={0}
      aria-hidden="true"
      {...rest}
    />
  );
});

/*
  India tricolour — a real flag, not a colour-blind emoji. Saffron, white,
  green with the Ashoka chakra, drawn at the phone-prefix scale.
*/
export const FlagIN = forwardRef(function FlagIN({ size = 18, ...rest }, ref) {
  const w = size;
  const h = Math.round((size * 2) / 3);
  return (
    <svg
      ref={ref}
      width={w}
      height={h}
      viewBox="0 0 24 16"
      role="img"
      aria-label="India"
      {...rest}
    >
      <defs>
        <clipPath id="flagIN-round">
          <rect x="0.5" y="0.5" width="23" height="15" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#flagIN-round)">
        <rect x="0" y="0" width="24" height="5.33" fill="#FF9933" />
        <rect x="0" y="5.33" width="24" height="5.34" fill="#FFFFFF" />
        <rect x="0" y="10.67" width="24" height="5.33" fill="#138808" />
        <circle cx="12" cy="8" r="1.9" fill="none" stroke="#0A3D91" strokeWidth="0.7" />
        <circle cx="12" cy="8" r="0.4" fill="#0A3D91" />
      </g>
      <rect x="0.5" y="0.5" width="23" height="15" rx="2.5" fill="none" stroke="#00000018" strokeWidth="1" />
    </svg>
  );
});

/*
  Live dot — a soft-pulsing marker for an active recording or call timer.
  Colour comes from the caller (emergency red on the call HUD).
*/
export const IconLive = forwardRef(function IconLive({ size = 8, ...rest }, ref) {
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
});
