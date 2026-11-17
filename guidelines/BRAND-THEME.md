# Brand Theme (fixed)

The colour reference is inspired by Bhanzu's palette. **Colours only.** Do not use Bhanzu logos, illustrations, mascots, text, fonts or layouts.
**Light theme only.** Every hex value lives in `design-tokens/tokens.json`. Never type a colour in screen code.

## Palette (never change, never add brand colours)
| Token | Hex | Used for |
|---|---|---|
| `brand.orange` | `#F45803` | Primary buttons, important actions, calls to action |
| `brand.ice` | `#EEF4FF` | Page and section backgrounds |
| `brand.lime` | `#72CF10` | Progress, success, completed lessons |
| `brand.blue` | `#5C8FF7` | Links (underline), navigation highlight, interactive elements, focus |
| `brand.white` | `#FFFFFF` | Cards, forms, content surfaces |
| `brand.navy` | `#14264C` | Headings, body text, sidebar navigation |
| `functional.error` | `#C62828` | **Only** errors, Rejected/Blocked, delete actions (the owner allowed one functional colour) |

Opacity tints of these colours are allowed **only** as named tokens (hover, selected, disabled, borders, secondary text).

## Contrast rules (WCAG AA)
| Pair | Ratio | Rule |
|---|---|---|
| Navy on White / Ice | 14.9 / 13.5 | All text |
| Navy on Lime | 7.5 | Success badges, completed ticks |
| Navy on Blue | 4.76 | Pending/Scheduled badges |
| White on Navy | 14.9 | Sidebar text; the active item uses a Blue indicator bar + White text |
| White on Orange | 3.36 | **Bold ≥ 19 px only** (primary buttons) |
| Blue on White | 3.12 | Not for normal text. Links = Navy text + 2 px Blue underline. Focus ring = 2 px Blue with a 2 px White offset |
| Lime on White | 1.97 | Never alone. Progress bars always show a Navy "%" label. Completed = Lime circle + Navy tick |
| Orange text on White | 3.36 | Bold ≥ 19 px or icons only |
| White on Error / Error on White | 5.6 | All text |

## Components
- **Primary button:** Orange fill, White bold label at 19 px or more; hover uses the `orange-hover` tint overlay.
- **Compact button** (tables, toolbars): White fill, Navy label, 2 px Orange border.
- **Secondary button:** White fill, Navy label, Navy 24% border.
- **Danger button:** Error fill, White label.
- **Status badges:** each has an icon and a word as well as its colour.
  - Approved/Published/Completed = Lime + Navy text
  - Pending/Scheduled = Blue + Navy text
  - Draft/Paused/Expired = Ice + Navy text + Navy 24% border
  - Rejected/Blocked = Error + White text
- **Layout:**
  - Page background is Ice; cards and forms are White; text is Navy and secondary text is Navy 64%.
  - The sidebar (Teacher/Admin/Student) is Navy with White text, and the active item has a Blue bar.
  - The public header is White with Navy text and an Orange "Enroll / Request demo" call to action.

All three roles (Student, Teacher, Admin) share **one theme**. They differ in layout only, never in colour.
