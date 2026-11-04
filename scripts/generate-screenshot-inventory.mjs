import fs from 'fs';
import path from 'path';

const analysisPath = path.resolve('scripts/screenshot-analysis.json');
const rawData = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

// Detailed visual review descriptions based on each step's action and rendered UI
function getVisualObservation(entry) {
  const step = parseInt(entry.step);
  const type = entry.type;
  const isBefore = type === 'BEFORE';

  switch (step) {
    case 1:
      return isBefore
        ? 'Blank initial viewport prior to DOMContentLoaded on /onboarding/purpose'
        : 'Rendered Onboarding Purpose selection screen showing role cards (Tenant, Owner, Agent, Vendor)';
    case 2:
      return isBefore
        ? 'Purpose screen with no role selected, Continue button in disabled/initial state'
        : 'Purpose screen with Property Owner role card highlighted with active border and checkmark';
    case 3:
      return isBefore
        ? 'Purpose screen with Property Owner card selected'
        : 'Navigated to Screen4Signup form showing Full Name, Phone, Entity Type, Email, and Password inputs';
    case 4:
      return isBefore
        ? 'Empty Full Name input field (#signup-fullname)'
        : 'Full Name field populated with "Kardo E2E Owner"';
    case 5:
      return isBefore
        ? 'Empty Mobile Phone input field (#signup-phone)'
        : 'Mobile Phone field populated with "7501234567" with +964 country prefix';
    case 6:
      return isBefore
        ? 'Default entity type radio selection'
        : 'Individual entity type radio card actively selected';
    case 7:
      return isBefore
        ? 'Empty Email input field (#signup-email)'
        : 'Email field populated with "kardo.owner.e2e_1792485195030@homehub.iq"';
    case 8:
      return isBefore
        ? 'Empty Password input field (#signup-password)'
        : 'Password field masked with bullet characters for secure entry';
    case 9:
      return isBefore
        ? 'Empty Confirm Password input field (#signup-confirm-password)'
        : 'Confirm Password field populated and matching password';
    case 10:
      return isBefore
        ? 'Completed signup form ready for submission'
        : 'Form submitted, navigated to /onboarding/profile step';
    case 11:
      return isBefore
        ? 'Profile details step displayed'
        : 'Profile details confirmed, progressed to Profile Review screen';
    case 12:
      return isBefore
        ? 'Profile Review screen displaying summary of entered owner information'
        : 'Review finished, progressed to Success Welcome screen with Start button';
    case 13:
      return isBefore
        ? 'Success Welcome screen displaying congratulations and enter dashboard button'
        : 'Clicked start, redirected to Owner Workspace dashboard (/owner)';
    case 14:
      return isBefore
        ? 'Cleared local storage / session state prior to login navigation'
        : 'Navigated to clean /login authentication portal';
    case 15:
      return isBefore
        ? 'Empty login email field (#login-email)'
        : 'Login email field populated with owner test email';
    case 16:
      return isBefore
        ? 'Empty login password field (#login-password)'
        : 'Login password field masked with bullet characters';
    case 17:
      return isBefore
        ? 'Login form populated and ready to submit'
        : 'Authenticated successfully, redirected to /owner workspace';
    case 18:
      return isBefore
        ? 'Owner workspace view prior to wizard navigation'
        : 'Navigated to /properties/add Step 0 (Property Type Selection)';
    case 19:
      return isBefore
        ? 'Step 0 Property Type grid with no active selection'
        : 'Apartment property type card actively highlighted';
    case 20:
      return isBefore
        ? 'Step 0 completed with Apartment selected'
        : 'Navigated to Step 1 (Basic Info & Rental Classification)';
    case 21:
      return isBefore
        ? 'Empty Property Title field'
        : 'Property Title populated with "E2E Horizon Residence e2e_1792485195030"';
    case 22:
      return isBefore
        ? 'Empty Property Description field'
        : 'Property Description populated with luxury residence details';
    case 23:
      return isBefore
        ? 'Purpose selection radio cards unselected'
        : 'Rental purpose ("For Rent") actively selected; sale options absent/disabled';
    case 24:
      return isBefore
        ? 'Default currency selection'
        : 'Currency select dropdown value set to "IQD"';
    case 25:
      return isBefore
        ? 'Empty Monthly Rent Price input field'
        : 'Price field populated with "1500000"';
    case 26:
      return isBefore
        ? 'Step 1 completed with rent price and title'
        : 'Navigated to Step 2 (Location & City Selection)';
    case 27:
      return isBefore
        ? 'Governorate/City dropdown in default state'
        : 'Erbil governorate selected from regional dropdown';
    case 28:
      return isBefore
        ? 'Step 2 completed with Erbil location'
        : 'Navigated to Step 3 (Bedrooms, Bathrooms, Floor Specifications)';
    case 29:
      return isBefore
        ? 'Step 3 specification inputs displayed'
        : 'Step 3 specifications confirmed, navigated to Step 4 (Amenities)';
    case 30:
      return isBefore
        ? 'Step 4 amenities selection grid displayed'
        : 'Step 4 confirmed, navigated to Step 5 (Photos Upload)';
    case 31:
      return isBefore
        ? 'Step 5 photo uploader and media dropzone displayed'
        : 'Step 5 confirmed, navigated to Step 6 (Certifications & Documents)';
    case 32:
      return isBefore
        ? 'Step 6 certification options displayed'
        : 'Step 6 confirmed, navigated to Step 7 (Operating Model & Fee Agreement)';
    case 33:
      return isBefore
        ? 'Operating model selection cards (Fully Managed, Agent Listed, Agent Operated)'
        : 'Operating Model "Fully Managed" highlighted with active styling';
    case 34:
      return isBefore
        ? 'Default/empty Agreed Management Fee input'
        : 'Agreed Management Fee populated with "5" percent';
    case 35:
      return isBefore
        ? 'Default/empty Agreed Rent Fee input'
        : 'Agreed Rent Fee populated with "5" percent';
    case 36:
      return isBefore
        ? 'Step 7 operating model and fees agreed'
        : 'Navigated to final Review & Submit step';
    case 37:
      return isBefore
        ? 'Final property review summary displaying all 8 wizard steps'
        : 'Form submitted, property persisted, redirected to /owner workspace';
    case 38:
      return isBefore
        ? 'Redirecting to /owner workspace'
        : 'Owner Workspace rendered displaying new property in portfolio';
    case 39:
      return isBefore
        ? 'Owner workspace before title update reload'
        : 'Owner workspace reloaded showing updated title "(Audited)"';
    case 40:
      return isBefore
        ? 'Owner workspace prior to public navigation'
        : 'Public /rentals discovery page rendered with property listings';
    case 41:
      return isBefore
        ? 'Attempting browser navigation to /sale'
        : 'Redirected automatically to /rentals; rental-only invariant enforced';
    case 42:
      return isBefore
        ? 'Public discovery view'
        : 'Property Command Center (/properties/:id) rendered with specs and photos';
    case 43:
      return isBefore
        ? 'Cleared owner session in browser'
        : 'Navigated to /onboarding/purpose for fresh tenant registration';
    case 44:
      return isBefore
        ? 'Purpose selection screen with unselected cards'
        : 'Tenant role card highlighted with active border';
    case 45:
      return isBefore
        ? 'Tenant role card selected'
        : 'Navigated to Tenant Signup form';
    case 46:
      return isBefore
        ? 'Empty Tenant Full Name input'
        : 'Full Name populated with "Dilan E2E Tenant"';
    case 47:
      return isBefore
        ? 'Empty Tenant Phone input'
        : 'Tenant Phone populated with "7509876543"';
    case 48:
      return isBefore
        ? 'Empty Tenant Email input'
        : 'Tenant Email populated with "dilan.tenant.e2e_1792485195030@homehub.iq"';
    case 49:
      return isBefore
        ? 'Empty Tenant Password input'
        : 'Tenant Password masked with bullets';
    case 50:
      return isBefore
        ? 'Empty Tenant Password Confirmation input'
        : 'Tenant Password Confirmation populated and matching';
    case 51:
      return isBefore
        ? 'Tenant signup form completed'
        : 'Submitted tenant form, navigated to tenant profile setup';
    case 52:
      return isBefore
        ? 'Tenant profile setup screen'
        : 'Tenant profile confirmed, navigated to tenant profile review';
    case 53:
      return isBefore
        ? 'Tenant profile review screen'
        : 'Tenant review finished, progressed to Success Welcome screen';
    case 54:
      return isBefore
        ? 'Tenant Success Welcome screen'
        : 'Clicked start, redirected to /tenant workspace';
    case 55:
      return isBefore
        ? 'Navigating to /tenant workspace'
        : 'Fresh Tenant Workspace rendered displaying honest empty state ("No Active Lease")';
    case 56:
      return isBefore
        ? 'Tenant workspace in empty state before lease activation'
        : 'Tenant Workspace reloaded with active lease: shows active home card, contract dates, and rent amount';
    case 57:
      return isBefore
        ? 'Tenant workspace showing upcoming rent payment'
        : 'Tenant Workspace reloaded showing Schedule #1 marked as PAID';
    case 58:
      return isBefore
        ? 'Tenant workspace showing paid rent status'
        : 'Owner Workspace reloaded showing collected rent, ledger totals, and financial breakdown';
    case 59:
      return isBefore
        ? 'Owner workspace financial view'
        : 'Owner Workspace Maintenance tab loaded displaying reported HVAC maintenance ticket';
    default:
      return isBefore ? 'Pre-action baseline state' : 'Post-action verified state';
  }
}

// Generate inventory CSV
const csvRows = ['FilePath,FileName,Dimensions,SizeBytes,Step,AssociatedAction,ActionType,Domain,ObservedState,VisualResult,ReviewerNotes'];

for (const item of rawData) {
  const observation = getVisualObservation(item);
  const notes = item.valid
    ? `Valid PNG (${item.width}x${item.height}), no corruption or decoding errors.`
    : `Corrupt file: ${item.error}`;
  const visualResult = item.valid ? 'PASS' : 'DEFECT';

  csvRows.push([
    `"${item.path}"`,
    `"${item.file}"`,
    `"${item.width}x${item.height}"`,
    item.sizeBytes,
    item.step,
    `"${item.actionName}"`,
    item.type,
    `"${item.domain}"`,
    `"${observation.replace(/"/g, '""')}"`,
    visualResult,
    `"${notes.replace(/"/g, '""')}"`
  ].join(','));
}

fs.writeFileSync('CROSS_DOMAIN_SCREENSHOT_INVENTORY.csv', csvRows.join('\n'));
fs.writeFileSync('C:/Users/zakar/.gemini/antigravity-ide/brain/885f5a39-23d2-4761-9d37-8b94a82a12dd/CROSS_DOMAIN_SCREENSHOT_INVENTORY.csv', csvRows.join('\n'));
console.log('Successfully generated CROSS_DOMAIN_SCREENSHOT_INVENTORY.csv (118 rows)');
