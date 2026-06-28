# AGENT.md

# Amruni Frontend Development Guide

## Purpose

This document defines the architecture, coding standards, project conventions, and development workflow for the Amruni frontend.

Every contributor or AI coding agent must follow these guidelines to ensure the project remains scalable, maintainable, and production-ready.

---

# Tech Stack

* React 19
* Vite
* React Router DOM v7
* Framer Motion
* Axios
* JavaScript (ES Modules)

Future integrations may include:

* Firebase / Node Backend
* WebRTC
* Socket.IO
* REST APIs

---

# Core Development Principles

The project must always follow these principles:

* Feature-Based Architecture
* Single Responsibility Principle
* Reusability over Duplication
* Composition over Inheritance
* Performance First
* Mobile First
* Accessibility First
* Production-Ready Code
* Clean Architecture
* Separation of Concerns

---

# Project Folder Structure

```
src
│
├── app/
│   ├── App.jsx
│   ├── main.jsx
│   └── providers/
│
├── assets/
│
├── components/
│   ├── common/
│   ├── ui/
│   ├── layout/
│   ├── navigation/
│   └── feedback/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── profile/
│   ├── appointments/
│   ├── doctors/
│   ├── telemedicine/
│   ├── pregnancy/
│   ├── menstrual-health/
│   ├── mental-health/
│   ├── emergency/
│   ├── medicine/
│   ├── hospitals/
│   ├── elderly-care/
│   ├── notifications/
│   ├── reports/
│   └── settings/
│
├── hooks/
│
├── context/
│
├── services/
│
├── routes/
│
├── layouts/
│
├── constants/
│
├── utils/
│
├── styles/
│
└── config/
```

---

# Feature Structure

Every feature must be self-contained.

```
feature/

components/

pages/

hooks/

services/

context/

utils/

constants/
```

A feature should be removable without affecting other features.

---

# Routing Rules

Each major feature owns its own routes.

Example:

```
/
/dashboard
/profile
/doctors
/appointments
/telemedicine
/emergency
/settings
/doctor/:id (Doctor Profile)
/appointment/:id (Book Appointment)
/waiting/:appointmentId (Matching Waiting Room)
/video/:appointmentId (Immersive Live Video Call)
/consultation/:id (Consultation Summary & Prescription)
```

Rules:

* Routes belong inside `src/routes`
* Never define routes inside reusable components
* Lazy-load feature pages

---

# Component Rules

Components should only have one responsibility.

Good

```
DoctorCard

AppointmentCard

PrimaryButton

VideoControls

ProfileHeader
```

Bad

```
DashboardEverything.jsx
```

Rules

* One responsibility
* Small and reusable
* UI only
* No API calls
* No business logic
* Less than 200 LOC

---

# Page Rules

Pages compose components.

A page should look like:

```
DashboardPage

↓

Header

↓

Statistics

↓

UpcomingAppointments

↓

QuickActions

↓

Footer
```

Pages should not contain complex business logic.

Maximum: 300 LOC

---

# State Management

Use local state whenever possible.

Use Context only for:

* Authentication
* Theme
* User Session
* Global Notifications
* Active Video Session

Avoid unnecessary global state.

---

# API & Services

Every API request belongs inside:

```
services/
```

Examples:

```
doctorService.js

appointmentService.js

userService.js

notificationService.js
```

Never call fetch() directly inside pages or UI components.

---

# Hooks

Business logic belongs inside hooks.

Examples:

```
useDoctors()

useAppointments()

useCountdown()

useNotifications()

useProfile()
```

Hooks should not render UI.

---

# Utilities

Utility functions must be pure.

Examples:

```
formatDate()

formatTime()

calculateAge()

validateEmail()

generateAvatar()

debounce()

throttle()
```

---

# Constants

Store all fixed values inside constants.

Examples

```
API_URL

Routes

Roles

Status

Theme Colors

Error Messages

Regex Patterns
```

Never hardcode values repeatedly.

---

# Naming Conventions

Components

```
PascalCase
```

Example

```
DoctorCard.jsx
```

Hooks

```
camelCase

useDoctors.js
```

Services

```
doctorService.js
```

Utilities

```
formatDate.js
```

Constants

```
routes.js

roles.js

colors.js
```

---

# Import Order

Always maintain this order:

1. React

2. Third-party libraries

3. Components

4. Hooks

5. Services

6. Utilities

7. Constants

8. Styles

---

# Styling Guidelines

Keep styling consistent.

* Prefer CSS Modules or feature-specific CSS
* Avoid inline styles except dynamic values
* Avoid global CSS pollution
* Reuse utility classes

---

# Performance Rules

Always optimize.

Mandatory:

* React.lazy
* Suspense
* React.memo
* useMemo
* useCallback
* Code Splitting
* Dynamic Imports
* Lazy Image Loading
* Skeleton Loaders
* Debouncing
* Throttling
* Pagination
* Virtualized Lists (when required)

Avoid:

* Unnecessary Context updates
* Prop drilling beyond two levels
* Re-rendering large lists
* Anonymous functions inside large map() calls

---

# Responsive Design

Every screen must support:

* Mobile
* Tablet
* Laptop
* Desktop

Develop mobile-first.

---

# Accessibility

Every feature should include:

* aria-labels
* Semantic HTML
* Keyboard navigation
* Focus states
* alt text for images
* Form labels

Accessibility is mandatory.

---

# Error Handling

Every async operation must handle:

* Loading
* Success
* Error
* Timeout
* Empty State

Never leave blank screens.

---

# Loading States

Use Skeleton Loaders instead of spinners whenever possible.

Every page should have a loading UI.

---

# Animation Guidelines

Use Framer Motion.

Animate only when it improves UX.

Recommended:

* Page transitions
* Cards
* Dialogs
* Drawers
* Floating buttons
* Modals

Avoid excessive animation.

Target duration:

200–300ms

---

# Security Guidelines

Never:

* Store secrets in frontend
* Hardcode API keys
* Expose private URLs
* Trust client-side validation alone

Always validate data before submission.

---

# File Size Limits

Component

< 200 LOC

Page

< 300 LOC

Hook

< 200 LOC

Service

< 150 LOC

Split files if limits are exceeded.

---

# Development Workflow

Every feature must follow this sequence.

```
Understand Requirement

↓

Research Existing Code

↓

Reuse Existing Components

↓

Create Routes

↓

Create Pages

↓

Create Components

↓

Create Hooks

↓

Create Services

↓

Implement UI

↓

Implement Business Logic

↓

Connect APIs

↓

Loading States

↓

Error Handling

↓

Responsive Testing

↓

Optimization

↓

Final Review
```

---

# Code Review Checklist

Before completing any task, verify:

* No duplicate code
* Proper folder placement
* Naming conventions followed
* Components are reusable
* Business logic extracted
* APIs isolated
* Responsive UI
* Accessibility added
* Error handling complete
* Loading state present
* No console.log()
* No unused imports
* No dead code
* No hardcoded data
* Performance considered

---

# Definition of Done

A feature is complete only when:

* Route created
* Feature folder created
* Components modularized
* Hooks extracted
* Services implemented
* Constants used
* Utilities reused
* Loading implemented
* Error state implemented
* Empty state implemented
* Responsive on all devices
* Accessible
* Animations completed
* Optimized
* Ready for backend integration

---

# AI Agent Rules

Every AI coding agent must:

1. Search for reusable components before creating new ones.
2. Follow the existing folder structure.
3. Never duplicate logic.
4. Never place API logic inside UI components.
5. Keep components small and modular.
6. Write maintainable and readable code.
7. Preserve project architecture.
8. Optimize before introducing complexity.
9. Build production-ready implementations.
10. Ensure every change is scalable and consistent with this document.

---

# Future Scalability

The architecture must support future modules without restructuring the project.

Examples:

* AI Chatbot
* Pharmacy
* Lab Reports
* Nutrition
* Fitness
* Wearables
* Payments
* Insurance
* Community
* Analytics

Adding a new module should only require creating a new folder inside `features/` without modifying existing features.

---

# Golden Rules

* Build for scalability.
* Prefer reuse over rewrite.
* Keep logic separate from UI.
* Write readable code.
* Keep components focused.
* Optimize by default.
* Avoid technical debt.
* Every feature should be independently maintainable.
* Treat every implementation as production-ready.
