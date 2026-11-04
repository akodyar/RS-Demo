# Prompt 5: Visual Fidelity & Layout Inversion Correction

- **Sequence**: #5 of 6
- **Phase**: Design Alignment & Defect Fixes
- **Timestamp**: 2026-09-18 Turn 5
- **Filename**: `prompt-05-visual-fidelity-and-rtl-fix.md`

---

## 📝 User Prompt

```text
[Attached Screenshot: Screenshot_20260918-182248.png]
This is what you have created and it is far more different than what I have asked you to use.
```

---

## 🛠️ Implemented Outcome

- Fixed RTL layout inversions:
  * Top bar: Enforced LTR layout so HomeHub 3D logo is anchored on the LEFT and the Language Selector pill is on the RIGHT.
  * Primary Button: Positioned the forward arrow (→) on the RIGHT side of 'دەستپێ بکە' pointing right.
  * Pagination Dots: Set LTR ordering so the active blue dot is on the far LEFT (● ○ ○ ○).
- Replaced cold daylight building image with the warm luxury two-story modern glass villa at dusk with turquoise pool and amber lighting.
- Replaced distorted icon fills with crisp custom vector SVGs for House, Key, Building, and Wrench.
- Hid simulated iOS status bar and home indicator on mobile viewports to prevent double-rendering on real mobile devices.
