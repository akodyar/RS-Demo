import os
import zipfile

prompts_data = [
    {
        "filename": "prompt-01-initial-platform-specification",
        "title": "Prompt 1: Multi-Role Real Estate Platform Architecture (HomeHub)",
        "phase": "Foundation & Core Architecture",
        "timestamp": "2026-09-18 Session Start",
        "user_prompt": """Create a comprehensive real estate application named 'HomeHub' (HomeHub — پلاتفۆرمی مۆدێرنی خانووبەرە) tailored for Kurdistan and Iraq, featuring:
1. Multilingual support: Kurdish Sorani (کوردی), Arabic (العربية), and English (English), with dynamic RTL (Right-to-Left) and LTR layout switching.
2. 6 distinct user roles with tailored workspaces:
   - Owner / Landlord (خاوەن موڵک): Property listings, tenant contracts, rent collection, maintenance dispatch.
   - Buyer (کڕیار): Filtered property search, favorites, direct owner inquiries, scheduled viewings.
   - Tenant (کرێچی): Active lease management, digital rent payments, maintenance request tracker.
   - Real Estate Agency / Company (کۆمپانیای خانووبەرە): Multi-agent management, verified MLS listings, deal pipeline.
   - Service Provider / Vendor (خزمەتگوزاری): Maintenance job board, quotes, active repairs, invoice settlement.
   - Platform Admin / Property Manager (بەڕێوەبەر): System audit logs, KYC verification, listings moderation.
3. Property lifecycle management: Buy, Rent, Sell, Services, Property Passport, and maintenance workflows.
4. Clean, responsive design supporting mobile and desktop viewports.""",
        "implementation_summary": """- Built responsive layout with Tailwind CSS and dynamic RTL/LTR direction provider.
- Created mock & dynamic database schema supporting properties, contracts, maintenance requests, and audit logs.
- Implemented role-based workspace switcher allowing instant testing between all 6 personas.
- Built property search, passport details, contract acceptance, and maintenance ticketing."""
    },
    {
        "filename": "prompt-02-company-and-tenant-onboarding",
        "title": "Prompt 2: Specialized Company & Tenant Onboarding Flows",
        "phase": "Onboarding & Registration Workflows",
        "timestamp": "2026-09-18 Turn 2",
        "user_prompt": """Implement dedicated onboarding flows for:
1. Real Estate Companies: Agency registration, commercial license verification, office branch details, agent team invitations, and initial portfolio batch upload.
2. Tenants: Digital lease acceptance, security deposit receipt confirmation, emergency contact setup, and direct maintenance request initiation.
3. Add routing and navigation for /onboarding/tenant, /onboarding/company, and /tenant/maintenance/new.""",
        "implementation_summary": """- Created TenantOnboardingPage and CompanyOnboardingPage with multi-step interactive wizard validation.
- Added TenantMaintenanceRequest component for submitting photos, urgency levels, and category selection.
- Linked new routes with role-based navigation guards and breadcrumbs."""
    },
    {
        "filename": "prompt-03-full-kurdish-localization-and-workspaces",
        "title": "Prompt 3: Kurdish Sorani Localization & Workspaces Hardening",
        "phase": "Localization & Production Polish",
        "timestamp": "2026-09-18 Turn 3",
        "user_prompt": """Localize all workspace views, headings, navigation elements, action buttons, and status labels into natural Kurdish Sorani.
Remove English placeholders and ensure consistent real estate terminology (خاوەن موڵک, کرێچی, پشکنین, گرێبەست, خزمەتگوزاری, کرێی مانگانە, دۆخی داواکاری) across the Owner, Tenant, Vendor, Company, and Admin dashboards.""",
        "implementation_summary": """- Built comprehensive Kurdish Sorani translation dictionaries and i18n hooks.
- Updated all card headers, filter pills, table columns, and status badges with authentic Kurdish terminology.
- Integrated audit log event localization and currency formatting (IQD / USD)."""
    },
    {
        "filename": "prompt-04-mobile-onboarding-design-reference",
        "title": "Prompt 4: Master Mobile Onboarding Screen Integration (Design Reference)",
        "phase": "Visual Redesign & Entry Point",
        "timestamp": "2026-09-18 Turn 4",
        "user_prompt": """[Attached Reference Image: file_00000000fbdc8243b0e3271f11368a1e.png]
Make the first page that appears when opening the application strictly match the provided reference design:
- Full-bleed background of a modern luxury glass villa at dusk with illuminated turquoise pool and warm glowing interior.
- HomeHub 3D badge with royal blue roof, white body, and 4 emerald window panes, plus the Kurdish tagline 'ماڵی باشتر، ژیانی باشتر'.
- Translucent frosted language switcher pill ('🌐 کوردی ⌵') on top.
- Kurdish headline: 'هەموو ڕێگاکان بۆ موڵک لە یەک شوێن' and subtitle: 'پلاتفۆڕمێکی مۆدێرن بۆ کڕین، فرۆشتن، کرێ، بەڕێوەبردنی موڵک و خزمەتگوزاری.'.
- Floating bottom white card with 4 pastel quick-action tiles: کڕین (House), کرێ (Key), فرۆشتن (Building), خزمەتگوزاری (Wrench).
- Primary pill button 'دەستپێ بکە' with right-pointing arrow.
- Secondary sign-in text: 'هەژماری هەیە؟ چوونە ژوورەوە'.
- 4 pagination indicator dots with the first dot active.
- Set this as the root entry point ('/') of the application.""",
        "implementation_summary": """- Configured root route '/' to render the welcome onboarding screen.
- Built 4-step interactive onboarding flow: Welcome -> Capabilities -> Role Selection -> Registration -> Success.
- Replicated the visual layout, typography, and color palette from the reference image."""
    },
    {
        "filename": "prompt-05-visual-fidelity-and-rtl-fix",
        "title": "Prompt 5: Visual Fidelity & Layout Inversion Correction",
        "phase": "Design Alignment & Defect Fixes",
        "timestamp": "2026-09-18 Turn 5",
        "user_prompt": """[Attached Screenshot: Screenshot_20260918-182248.png]
This is what you have created and it is far more different than what I have asked you to use.""",
        "implementation_summary": """- Fixed RTL layout inversions:
  * Top bar: Enforced LTR layout so HomeHub 3D logo is anchored on the LEFT and the Language Selector pill is on the RIGHT.
  * Primary Button: Positioned the forward arrow (→) on the RIGHT side of 'دەستپێ بکە' pointing right.
  * Pagination Dots: Set LTR ordering so the active blue dot is on the far LEFT (● ○ ○ ○).
- Replaced cold daylight building image with the warm luxury two-story modern glass villa at dusk with turquoise pool and amber lighting.
- Replaced distorted icon fills with crisp custom vector SVGs for House, Key, Building, and Wrench.
- Hid simulated iOS status bar and home indicator on mobile viewports to prevent double-rendering on real mobile devices."""
    },
    {
        "filename": "prompt-06-export-prompts-request",
        "title": "Prompt 6: Export All Prompts as Downloadable Files",
        "phase": "Export & Documentation",
        "timestamp": "2026-09-18 Turn 6 (Current)",
        "user_prompt": """give me all the prompts I have given to you. in separate files ready to download""",
        "implementation_summary": """- Extracted all user prompts from the conversation lifecycle with full context and metadata.
- Generated individual downloadable Markdown (.md) and plain text (.txt) files for each prompt.
- Packaged all prompt files into a single-click ZIP archive (homehub-all-prompts.zip).
- Created a downloadable Prompts Center with direct browser download links and preview modals."""
    }
]

def generate_files():
    base_dirs = ["prompts", "public/prompts"]
    for d in base_dirs:
        os.makedirs(d, exist_ok=True)

    summary_md = ["# HomeHub — Complete User Prompts Archive\\n\\nThis archive contains all prompts provided by the user during the design and development of the HomeHub real estate platform.\\n\\n---\\n"]
    summary_txt = ["HOMEHUB — COMPLETE USER PROMPTS ARCHIVE\\n" + "="*50 + "\\n\\n"]

    all_files_to_zip = []

    for idx, item in enumerate(prompts_data, 1):
        # Markdown content
        md_content = f"""# {item['title']}

- **Sequence**: #{idx} of {len(prompts_data)}
- **Phase**: {item['phase']}
- **Timestamp**: {item['timestamp']}
- **Filename**: `{item['filename']}.md`

---

## 📝 User Prompt

```text
{item['user_prompt']}
```

---

## 🛠️ Implemented Outcome

{item['implementation_summary']}
"""

        # Plain text content
        txt_content = f"""{item['title']}
{"=" * len(item['title'])}
Sequence: #{idx} of {len(prompts_data)}
Phase: {item['phase']}
Timestamp: {item['timestamp']}

USER PROMPT:
----------------------------------------
{item['user_prompt']}
----------------------------------------

IMPLEMENTED OUTCOME:
{item['implementation_summary']}
"""

        summary_md.append(f"""### {idx}. {item['title']}
- **Phase**: {item['phase']}
- **Download**: [`{item['filename']}.md`](/prompts/{item['filename']}.md) | [`{item['filename']}.txt`](/prompts/{item['filename']}.txt)

```text
{item['user_prompt']}
```

---
""")

        summary_txt.append(f"""PROMPT #{idx}: {item['title']}
Phase: {item['phase']}
Prompt Text:
{item['user_prompt']}
----------------------------------------\\n\\n""")

        # Write to both folders
        for d in base_dirs:
            md_path = os.path.join(d, f"{item['filename']}.md")
            txt_path = os.path.join(d, f"{item['filename']}.txt")
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(txt_content)
            if d == "public/prompts":
                all_files_to_zip.append((md_path, f"{item['filename']}.md"))
                all_files_to_zip.append((txt_path, f"{item['filename']}.txt"))

    # Write summary files
    full_summary_md = "\\n".join(summary_md)
    full_summary_txt = "\\n".join(summary_txt)

    for d in base_dirs:
        with open(os.path.join(d, "all-prompts-summary.md"), "w", encoding="utf-8") as f:
            f.write(full_summary_md)
        with open(os.path.join(d, "all-prompts-summary.txt"), "w", encoding="utf-8") as f:
            f.write(full_summary_txt)
        if d == "public/prompts":
            all_files_to_zip.append((os.path.join(d, "all-prompts-summary.md"), "all-prompts-summary.md"))
            all_files_to_zip.append((os.path.join(d, "all-prompts-summary.txt"), "all-prompts-summary.txt"))

    # Create ZIP archive
    zip_path = "public/prompts/homehub-all-prompts.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path, arcname in all_files_to_zip:
            zf.write(file_path, arcname)

    # Also copy zip to prompts/
    with open(zip_path, "rb") as src, open("prompts/homehub-all-prompts.zip", "wb") as dst:
        dst.write(src.read())

    print(f"Successfully created {len(prompts_data)} prompt files in .md and .txt formats plus ZIP archive!")

if __name__ == "__main__":
    generate_files()
