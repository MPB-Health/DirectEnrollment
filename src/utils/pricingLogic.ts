import { Dependent } from '../hooks/useEnrollmentStorage';

export interface DirectEnrollmentPricingOption {
  productId: string;
  price: number;
  iuaLevel: string;
  displayText: string;
}

export interface DirectEnrollmentPricingResult {
  options: DirectEnrollmentPricingOption[];
  isAvailable: boolean;
  errorMessage?: string;
  coverageType: string;
}

export interface EssentialPricingResult {
  price: number;
  displayText: string;
  isAvailable: boolean;
  errorMessage?: string;
}

export interface BenefitPlan {
  id: string;
  name: string;
  allowsSpouse: boolean;
  allowsChildren: boolean;
  maxChildren: number;
  price: number;
}

export interface DirectEnrollmentPlanPrice {
  productId: string;
  price: number;
  iuaLevel: '1000' | '1250' | '2500' | '5000';
  ageRange: '18-29' | '30-49' | '50-64';
  coverageType: 'Member Only' | 'Member + Spouse' | 'Member + Children' | 'Member + Family';
}

export const DIRECT_ENROLLMENT_PLAN_PRICES: DirectEnrollmentPlanPrice[] = [
  // Member Only

  { productId: '10334', price: 295.0, iuaLevel: '1250', ageRange: '18-29', coverageType: 'Member Only' },
  { productId: '10334', price: 321.0, iuaLevel: '1250', ageRange: '30-49', coverageType: 'Member Only' },
  { productId: '10334', price: 415.0, iuaLevel: '1250', ageRange: '50-64', coverageType: 'Member Only' },
  { productId: '3279', price: 229.0, iuaLevel: '2500', ageRange: '18-29', coverageType: 'Member Only' },
  { productId: '3279', price: 280.0, iuaLevel: '2500', ageRange: '30-49', coverageType: 'Member Only' },
  { productId: '3279', price: 353.0, iuaLevel: '2500', ageRange: '50-64', coverageType: 'Member Only' },
  { productId: '3278', price: 201.0, iuaLevel: '5000', ageRange: '18-29', coverageType: 'Member Only' },
  { productId: '3278', price: 250.0, iuaLevel: '5000', ageRange: '30-49', coverageType: 'Member Only' },
  { productId: '3278', price: 282.0, iuaLevel: '5000', ageRange: '50-64', coverageType: 'Member Only' },
  // Member + Spouse
 
  { productId: '10335', price: 504.0, iuaLevel: '1250', ageRange: '18-29', coverageType: 'Member + Spouse' },
  { productId: '10335', price: 540.0, iuaLevel: '1250', ageRange: '30-49', coverageType: 'Member + Spouse' },
  { productId: '10335', price: 698.0, iuaLevel: '1250', ageRange: '50-64', coverageType: 'Member + Spouse' },
  { productId: '3285', price: 390.0, iuaLevel: '2500', ageRange: '18-29', coverageType: 'Member + Spouse' },
  { productId: '3285', price: 490.0, iuaLevel: '2500', ageRange: '30-49', coverageType: 'Member + Spouse' },
  { productId: '3285', price: 580.0, iuaLevel: '2500', ageRange: '50-64', coverageType: 'Member + Spouse' },
  { productId: '3286', price: 325.0, iuaLevel: '5000', ageRange: '18-29', coverageType: 'Member + Spouse' },
  { productId: '3286', price: 415.0, iuaLevel: '5000', ageRange: '30-49', coverageType: 'Member + Spouse' },
  { productId: '3286', price: 480.0, iuaLevel: '5000', ageRange: '50-64', coverageType: 'Member + Spouse' },
  // Member + Children

  { productId: '10336', price: 504.0, iuaLevel: '1250', ageRange: '18-29', coverageType: 'Member + Children' },
  { productId: '10336', price: 540.0, iuaLevel: '1250', ageRange: '30-49', coverageType: 'Member + Children' },
  { productId: '10336', price: 698.0, iuaLevel: '1250', ageRange: '50-64', coverageType: 'Member + Children' },
  { productId: '3290', price: 390.0, iuaLevel: '2500', ageRange: '18-29', coverageType: 'Member + Children' },
  { productId: '3290', price: 490.0, iuaLevel: '2500', ageRange: '30-49', coverageType: 'Member + Children' },
  { productId: '3290', price: 580.0, iuaLevel: '2500', ageRange: '50-64', coverageType: 'Member + Children' },
  { productId: '3291', price: 325.0, iuaLevel: '5000', ageRange: '18-29', coverageType: 'Member + Children' },
  { productId: '3291', price: 415.0, iuaLevel: '5000', ageRange: '30-49', coverageType: 'Member + Children' },
  { productId: '3291', price: 480.0, iuaLevel: '5000', ageRange: '50-64', coverageType: 'Member + Children' },
  // Member + Family
 
  { productId: '10337', price: 762.0, iuaLevel: '1250', ageRange: '18-29', coverageType: 'Member + Family' },
  { productId: '10337', price: 773.0, iuaLevel: '1250', ageRange: '30-49', coverageType: 'Member + Family' },
  { productId: '10337', price: 1006.0, iuaLevel: '1250', ageRange: '50-64', coverageType: 'Member + Family' },
  { productId: '3295', price: 623.0, iuaLevel: '2500', ageRange: '18-29', coverageType: 'Member + Family' },
  { productId: '3295', price: 700.0, iuaLevel: '2500', ageRange: '30-49', coverageType: 'Member + Family' },
  { productId: '3295', price: 855.0, iuaLevel: '2500', ageRange: '50-64', coverageType: 'Member + Family' },
  { productId: '3296', price: 505.0, iuaLevel: '5000', ageRange: '18-29', coverageType: 'Member + Family' },
  { productId: '3296', price: 630.0, iuaLevel: '5000', ageRange: '30-49', coverageType: 'Member + Family' },
  { productId: '3296', price: 707.0, iuaLevel: '5000', ageRange: '50-64', coverageType: 'Member + Family' },
];

export const BENEFIT_PLANS: Record<string, BenefitPlan> = {
  '449': {
    id: '449',
    name: 'Member Only',
    allowsSpouse: false,
    allowsChildren: false,
    maxChildren: 0,
    price: 49.95,
  },
  '145': {
    id: '145',
    name: 'Member plus One (Spouse or Child)',
    allowsSpouse: true,
    allowsChildren: true,
    maxChildren: 1,
    price: 59.95,
  },
  '3391': {
    id: '3391',
    name: 'Member + Family',
    allowsSpouse: true,
    allowsChildren: true,
    maxChildren: 99,
    price: 69.95,
  },
};

export function getBenefitPlan(benefitId: string): BenefitPlan | null {
  return BENEFIT_PLANS[benefitId] || null;
}

export function validateDependentsForBenefit(
  benefitId: string,
  dependents: Dependent[]
): { isValid: boolean; errorMessage?: string } {
  const plan = getBenefitPlan(benefitId);

  if (!plan) {
    return {
      isValid: false,
      errorMessage: 'Invalid benefit plan selected.',
    };
  }

  const spouseCount = dependents.filter(d => d.relationship === 'Spouse').length;
  const childCount = dependents.filter(d => d.relationship === 'Child').length;

  if (benefitId === '449') {
    if (dependents.length > 0) {
      return {
        isValid: false,
        errorMessage: 'Member Only plan does not allow dependents. Please use the correct enrollment link for your plan type.',
      };
    }
  }

  if (benefitId === '145') {
    if (dependents.length === 0) {
      return {
        isValid: false,
        errorMessage: 'Member plus One plan requires exactly one dependent (spouse or child).',
      };
    }
    if (dependents.length > 1) {
      return {
        isValid: false,
        errorMessage: 'Member plus One plan allows only one dependent. Please remove extra dependents or use the Family plan link.',
      };
    }
    if (spouseCount > 1 || childCount > 1) {
      return {
        isValid: false,
        errorMessage: 'Member plus One plan allows only one dependent (either one spouse or one child).',
      };
    }
  }

  if (benefitId === '3391') {
    if (spouseCount === 0) {
      return {
        isValid: false,
        errorMessage: 'Member + Family plan requires at least one spouse and one child.',
      };
    }
    if (childCount === 0) {
      return {
        isValid: false,
        errorMessage: 'Member + Family plan requires at least one child. If you only need to add a spouse, use the Member plus One plan link.',
      };
    }
  }

  return { isValid: true };
}

export function calculateEssentialPricing(dependents: Dependent[]): EssentialPricingResult {
  const spouseCount = dependents.filter(d => d.relationship === 'Spouse').length;
  const childCount = dependents.filter(d => d.relationship === 'Child').length;
  const totalDependents = dependents.length;

  if (totalDependents === 0) {
    return {
      price: 49.95,
      displayText: '$49.95 per Month for Member Only',
      isAvailable: true,
    };
  }

  if (spouseCount === 1 && childCount === 0) {
    return {
      price: 59.95,
      displayText: '$59.95 per Month for Member plus One (Spouse or Child)',
      isAvailable: true,
    };
  }

  if (spouseCount === 0 && childCount === 1) {
    return {
      price: 59.95,
      displayText: '$59.95 per Month for Member plus One (Spouse or Child)',
      isAvailable: true,
    };
  }

  if (spouseCount === 1 && childCount >= 1) {
    return {
      price: 69.95,
      displayText: '$69.95 per Month for Member + Family',
      isAvailable: true,
    };
  }

  if (spouseCount === 0 && childCount > 1) {
    return {
      price: 0,
      displayText: 'No product available',
      isAvailable: false,
      errorMessage: 'Multiple children require a family plan. Please add a spouse or remove children to continue.',
    };
  }

  return {
    price: 49.95,
    displayText: '$49.95 per Month for Member Only',
    isAvailable: true,
  };
}

export function calculateAgeFromDOB(dob: string): number | null {
  if (!dob || dob.length !== 10) return null;

  const [month, day, year] = dob.split('/').map(num => parseInt(num, 10));
  if (!month || !day || !year) return null;

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function getAgeRange(age: number): '18-29' | '30-49' | '50-64' | null {
  if (age >= 18 && age <= 29) return '18-29';
  if (age >= 30 && age <= 49) return '30-49';
  if (age >= 50 && age <= 64) return '50-64';
  return null;
}

export function getCoverageType(dependents: Dependent[]): 'Member Only' | 'Member + Spouse' | 'Member + Children' | 'Member + Family' {
  const spouseCount = dependents.filter(d => d.relationship === 'Spouse').length;
  const childCount = dependents.filter(d => d.relationship === 'Child').length;

  if (spouseCount === 0 && childCount === 0) return 'Member Only';
  if (spouseCount > 0 && childCount === 0) return 'Member + Spouse';
  if (spouseCount === 0 && childCount > 0) return 'Member + Children';
  return 'Member + Family';
}

/**
 * Ages with parseable MM/DD/YYYY DOBs (primary first, then dependents).
 * Dependents with missing/invalid DOBs are skipped until entry is complete.
 * Someone 65+ included here drives getAgeRange to null (household ineligible for 18–64 tiers).
 */
function collectHouseholdAges(primaryDob: string, dependents: Dependent[]): number[] {
  const ages: number[] = [];
  const primaryAge = calculateAgeFromDOB(primaryDob);
  if (primaryAge !== null) ages.push(primaryAge);
  for (const dep of dependents) {
    const a = calculateAgeFromDOB(dep.dob);
    if (a !== null) ages.push(a);
  }
  return ages;
}

/** Direct Enrollment IUA prices: age tier uses the oldest household member with a valid DOB (primary + dependents). */
export function getDirectEnrollmentPricingOptions(memberDOB: string, dependents: Dependent[]): DirectEnrollmentPricingResult {
  const ages = collectHouseholdAges(memberDOB, dependents);

  if (ages.length === 0) {
    return {
      options: [],
      isAvailable: false,
      errorMessage: 'Please enter a valid date of birth to see pricing options.',
      coverageType: 'Member Only',
    };
  }

  const pricingAge = Math.max(...ages);
  const ageRange = getAgeRange(pricingAge);

  if (!ageRange) {
    return {
      options: [],
      isAvailable: false,
      errorMessage: 'Coverage is available for members aged 18-64 only.',
      coverageType: 'Member Only',
    };
  }

  const coverageType = getCoverageType(dependents);

  const matchingPrices = DIRECT_ENROLLMENT_PLAN_PRICES.filter(
    p => p.ageRange === ageRange && p.coverageType === coverageType
  );

  if (matchingPrices.length === 0) {
    return {
      options: [],
      isAvailable: false,
      errorMessage: 'No pricing options available for this configuration.',
      coverageType,
    };
  }

  const options: DirectEnrollmentPricingOption[] = matchingPrices.map(p => ({
    productId: p.productId,
    price: p.price,
    iuaLevel: `$${p.iuaLevel}`,
    displayText: `$${p.price.toFixed(2)} per Month for ${coverageType} - $${p.iuaLevel} IUA (${p.productId})`,
  }));

  return {
    options,
    isAvailable: true,
    coverageType,
  };
}
