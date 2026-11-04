# Prompt 1: Multi-Role Real Estate Platform Architecture (HomeHub)

- **Sequence**: #1 of 6
- **Phase**: Foundation & Core Architecture
- **Timestamp**: 2026-09-18 Session Start
- **Filename**: `prompt-01-initial-platform-specification.md`

---

## 📝 User Prompt

```text
Create a comprehensive real estate application named 'HomeHub' (HomeHub — پلاتفۆرمی مۆدێرنی خانووبەرە) tailored for Kurdistan and Iraq, featuring:
1. Multilingual support: Kurdish Sorani (کوردی), Arabic (العربية), and English (English), with dynamic RTL (Right-to-Left) and LTR layout switching.
2. 6 distinct user roles with tailored workspaces:
   - Owner / Landlord (خاوەن موڵک): Property listings, tenant contracts, rent collection, maintenance dispatch.
   - Buyer (کڕیار): Filtered property search, favorites, direct owner inquiries, scheduled viewings.
   - Tenant (کرێچی): Active lease management, digital rent payments, maintenance request tracker.
   - Real Estate Agency / Company (کۆمپانیای خانووبەرە): Multi-agent management, verified MLS listings, deal pipeline.
   - Service Provider / Vendor (خزمەتگوزاری): Maintenance job board, quotes, active repairs, invoice settlement.
   - Platform Admin / Property Manager (بەڕێوەبەر): System audit logs, KYC verification, listings moderation.
3. Property lifecycle management: Buy, Rent, Sell, Services, Property Passport, and maintenance workflows.
4. Clean, responsive design supporting mobile and desktop viewports.
```

---

## 🛠️ Implemented Outcome

- Built responsive layout with Tailwind CSS and dynamic RTL/LTR direction provider.
- Created mock & dynamic database schema supporting properties, contracts, maintenance requests, and audit logs.
- Implemented role-based workspace switcher allowing instant testing between all 6 personas.
- Built property search, passport details, contract acceptance, and maintenance ticketing.
