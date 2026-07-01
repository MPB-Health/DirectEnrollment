import { useState, useEffect } from 'react';
import {
  useEnrollmentStorage,
  AppliedPromo,
  Dependent,
  PaymentInfo,
  QuestionnaireAnswers,
} from '../hooks/useEnrollmentStorage';
import { getDirectEnrollmentPricingOptions, calculateAgeFromDOB } from '../utils/pricingLogic';
import { generateEnrollmentPDF } from '../utils/generateEnrollmentPDF';
import { getDependentEmailDuplicateError } from '../utils/dependentEmailValidation';
import {
  getDependentPhoneDuplicateError,
  getDependentSsnDuplicateError,
  getPrimarySubscriberPhoneDuplicateError,
  getPrimarySubscriberSsnDuplicateError,
} from '../utils/dependentPhoneSsnDuplicateValidation';
import { isChildDependentUnder18ForContactOptional } from '../utils/dependentAgeValidation';
import { encryptSensitiveFields } from '../utils/payloadEncryption';
import {
  getOrCreateSubmissionId,
  clearSubmissionId,
  fetchSubmissionStatus,
} from '../utils/enrollmentSubmission';
import {
  isPremiumCareUnavailableState,
  PREMIUM_CARE_UNAVAILABLE_STATE_MESSAGE,
} from '../constants/prohibitedEnrollmentStates';
import ProgressIndicator from './ProgressIndicator';
import Step1PersonalInfo from './Step1PersonalInfo';
import Step2Questionnaire from './Step2Questionnaire';
import Step2AddressInfo from './Step2AddressInfo';
import ThankYouPage, { type ListBillSummary } from './ThankYouPage';

interface ApiResponse {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
  message?: string;
  debug?: {
    apiUrl?: string;
    formData?: string;
    memberJsonString?: string;
    maskedPayload?: any;
    payloadPreview?: any;
  };
}

interface EnrollmentWizardProps {
  benefitId: string | null;
  onBenefitIdChange: (benefitId: string) => void;
  agentId: string;
  employeeGroup?: string | null;
}

export default function EnrollmentWizard({ benefitId, onBenefitIdChange, agentId, employeeGroup = null }: EnrollmentWizardProps) {
  const { formData, currentStep, saveFormData, saveStep, clearStorage, clearFormDataOnly } = useEnrollmentStorage(benefitId, agentId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [finishingEnrollment, setFinishingEnrollment] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [listBillSummary, setListBillSummary] = useState<ListBillSummary | null>(null);
  const [invalidDependentIndices, setInvalidDependentIndices] = useState<number[]>([]);

  const [instanceId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const stored = sessionStorage.getItem('enrollment_instance');
    const isSubmitting = sessionStorage.getItem('form_submitting');
    if (stored && stored !== instanceId && !isSubmitting) {
      clearStorage();
    }
    sessionStorage.setItem('enrollment_instance', instanceId);
    return () => {
      sessionStorage.removeItem('enrollment_instance');
    };
  }, [instanceId, clearStorage]);

  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }, [currentStep]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const blankedDependents = formData.dependents.map(dep => ({
        ...dep,
        ssn: '',
      }));
      saveFormData({
        ...formData,
        ssn: '',
        payment: {
          ...formData.payment,
          ccNumber: '',
          achrouting: '',
          achaccount: '',
        },
        dependents: blankedDependents,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [formData, saveFormData]);


  const formatDateInput = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '');

    if (digitsOnly.length <= 2) {
      return digitsOnly;
    } else if (digitsOnly.length <= 4) {
      return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    } else {
      return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
    }
  };

  const validateDateInput = (value: string): boolean => {
    if (value.length !== 10) return false;

    const [month, day, year] = value.split('/').map(num => parseInt(num, 10));

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1925 || year > 2025) return false;

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return false;

    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let updatedData = { ...formData, [name]: value };

    if (name === 'dob') {
      const updatedProducts = formData.products.map(product =>
        product.id === 'care-plus'
          ? { ...product, selectedPlan: '', extractedBenefitId: undefined, extractedPrice: undefined }
          : product
      );
      updatedData = { ...updatedData, products: updatedProducts };
    }

    saveFormData(updatedData);

    if (name === 'state') {
      if (isPremiumCareUnavailableState(value)) {
        setErrors(prev => ({ ...prev, state: PREMIUM_CARE_UNAVAILABLE_STATE_MESSAGE }));
      } else {
        setErrors(prev => {
          const next = { ...prev };
          delete next.state;
          return next;
        });
      }
    } else if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (name === 'dob' && errors.essentialPlan) {
      setErrors(prev => ({ ...prev, essentialPlan: '' }));
    }
  };

  const handleClearError = (field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.dob.trim()) {
      newErrors.dob = 'Date of birth is required';
    } else if (!validateDateInput(formData.dob)) {
      newErrors.dob = 'Invalid date. Please enter a valid date in MM/DD/YYYY format';
    } else {
      const age = calculateAgeFromDOB(formData.dob);
      if (age !== null && age < 18) {
        newErrors.dob = 'Must be 18 years or older to enroll';
      }
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.smoker.trim()) newErrors.smoker = 'Smoker status is required';

    formData.dependents.forEach((dependent, index) => {
      const prefix = `dependent_${index}_`;
      if (!dependent.firstName.trim()) newErrors[`${prefix}firstName`] = 'First name is required';
      if (!dependent.lastName.trim()) newErrors[`${prefix}lastName`] = 'Last name is required';
      if (!dependent.dob.trim()) {
        newErrors[`${prefix}dob`] = 'Date of birth is required';
      } else if (!validateDateInput(dependent.dob)) {
        newErrors[`${prefix}dob`] = 'Invalid date. Please enter a valid date in MM/DD/YYYY format';
      } else {
        const age = calculateAgeFromDOB(dependent.dob);
        if (dependent.relationship === 'Spouse') {
          if (age !== null && age < 18) {
            newErrors[`${prefix}dob`] = 'Must be 18 years or older to enroll';
          }
        } else if (dependent.relationship === 'Child') {
          if (age !== null && age >= 26) {
            newErrors[`${prefix}dob`] = 'Dependent children must be under 26 years of age';
          }
        }
      }
      if (!dependent.smoker.trim()) newErrors[`${prefix}smoker`] = 'Smoker status is required';
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      setTimeout(() => {
        const errorElement = document.querySelector(`[name="${firstErrorKey}"]`) as HTMLElement;
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          errorElement.focus();
        }
      }, 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.address1.trim()) newErrors.address1 = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    } else if (isPremiumCareUnavailableState(formData.state)) {
      newErrors.state = PREMIUM_CARE_UNAVAILABLE_STATE_MESSAGE;
    }
    if (!formData.zipcode.trim()) {
      newErrors.zipcode = 'Zipcode is required';
    } else if (formData.zipcode.length !== 5 || !/^\d{5}$/.test(formData.zipcode)) {
      newErrors.zipcode = 'Zipcode must be exactly 5 digits';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        newErrors.phone = 'Phone number must be exactly 10 digits';
      } else {
        const dupPhone = getPrimarySubscriberPhoneDuplicateError(formData.phone, formData.dependents);
        if (dupPhone) {
          newErrors.phone = dupPhone;
        }
      }
    }
    if (!formData.ssn.trim()) {
      newErrors.ssn = 'Social Security number is required';
    } else {
      const ssnDigits = formData.ssn.replace(/\D/g, '');
      if (ssnDigits.length !== 9) {
        newErrors.ssn = 'Social Security number must be exactly 9 digits';
      } else {
        const dupSsn = getPrimarySubscriberSsnDuplicateError(formData.ssn, formData.dependents);
        if (dupSsn) {
          newErrors.ssn = dupSsn;
        }
      }
    }
    if (!formData.gender.trim()) newErrors.gender = 'Gender is required';
    if (!formData.effectiveDate.trim()) newErrors.effectiveDate = 'Effective date is required';
    if (!formData.preExistingConditionsAcknowledged.trim()) {
      newErrors.preExistingConditionsAcknowledged = 'You must acknowledge the pre-existing conditions terms';
    }

    if (formData.payment.paymentMethod === 'credit-card') {
      if (!formData.payment.ccType.trim()) newErrors.ccType = 'Card type is required';
      if (!formData.payment.ccNumber.trim()) {
        newErrors.ccNumber = 'Card number is required';
      } else if (formData.payment.ccNumber.length < 15 || formData.payment.ccNumber.length > 16) {
        newErrors.ccNumber = 'Invalid card number length';
      }
      if (!formData.payment.ccExpMonth.trim()) newErrors.ccExpMonth = 'Expiration month is required';
      if (!formData.payment.ccExpYear.trim()) {
        newErrors.ccExpYear = 'Expiration year is required';
      } else {
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        const expYear = parseInt(formData.payment.ccExpYear);
        const expMonth = parseInt(formData.payment.ccExpMonth);
        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
          newErrors.ccExpYear = 'Card has expired';
        }
      }
    } else if (formData.payment.paymentMethod === 'ach') {
      if (!formData.payment.achrouting.trim()) {
        newErrors.achrouting = 'Routing number is required';
      } else if (formData.payment.achrouting.length !== 9) {
        newErrors.achrouting = 'Routing number must be exactly 9 digits';
      }
      if (!formData.payment.achaccount.trim()) {
        newErrors.achaccount = 'Account number is required';
      }
      if (!formData.payment.achbank.trim()) {
        newErrors.achbank = 'Bank name is required';
      }
    } else if (formData.payment.paymentMethod === 'list-bill') {
      // List Bill requires no card or bank details.
    }

    const invalidIndices: number[] = [];
    formData.dependents.forEach((dependent, index) => {
      const prefix = `dependent_${index}_`;
      let hasError = false;

      /**
       * Children under 18 may enroll without email/phone/SSN. When this is true
       * we skip the "required" + duplicate checks for empty values, but keep
       * format + duplicate checks if the parent fills any of them in.
       */
      const skipContactRequired = isChildDependentUnder18ForContactOptional(
        dependent.dob,
        dependent.relationship,
      );

      // Only validate address fields if NOT using same address as subscriber
      if (!dependent.useSameAddress) {
        if (!dependent.address?.trim()) {
          newErrors[`${prefix}address`] = 'Address is required';
          hasError = true;
        }
        if (!dependent.city?.trim()) {
          newErrors[`${prefix}city`] = 'City is required';
          hasError = true;
        }
        if (!dependent.state?.trim()) {
          newErrors[`${prefix}state`] = 'State is required';
          hasError = true;
        }
        if (!dependent.zipcode?.trim()) {
          newErrors[`${prefix}zipcode`] = 'Zipcode is required';
          hasError = true;
        } else if (dependent.zipcode.length !== 5 || !/^\d{5}$/.test(dependent.zipcode)) {
          newErrors[`${prefix}zipcode`] = 'Zipcode must be exactly 5 digits';
          hasError = true;
        }
      }

      const emailValue = dependent.email?.trim() ?? '';
      if (!emailValue) {
        if (!skipContactRequired) {
          newErrors[`${prefix}email`] = 'Email address is required';
          hasError = true;
        }
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        newErrors[`${prefix}email`] = 'Email address must be valid';
        hasError = true;
      } else {
        const duplicateMsg = getDependentEmailDuplicateError(
          emailValue,
          index,
          formData.dependents,
          formData.email ?? ''
        );
        if (duplicateMsg) {
          newErrors[`${prefix}email`] = duplicateMsg;
          hasError = true;
        }
      }

      const phoneValue = dependent.phone?.trim() ?? '';
      if (!phoneValue) {
        if (!skipContactRequired) {
          newErrors[`${prefix}phone`] = 'Phone number is required';
          hasError = true;
        }
      } else {
        const phoneDigits = phoneValue.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
          newErrors[`${prefix}phone`] = 'Phone must be exactly 10 digits';
          hasError = true;
        } else {
          const dupPhoneMsg = getDependentPhoneDuplicateError(
            phoneValue,
            index,
            formData.dependents,
            formData.phone ?? ''
          );
          if (dupPhoneMsg) {
            newErrors[`${prefix}phone`] = dupPhoneMsg;
            hasError = true;
          }
        }
      }

      const ssnValue = dependent.ssn?.trim() ?? '';
      if (!ssnValue) {
        if (!skipContactRequired) {
          newErrors[`${prefix}ssn`] = 'Social Security is required';
          hasError = true;
        }
      } else {
        const ssnDigits = ssnValue.replace(/\D/g, '');
        if (ssnDigits.length !== 9) {
          newErrors[`${prefix}ssn`] = 'Social Security must be exactly 9 digits';
          hasError = true;
        } else {
          const dupSsnMsg = getDependentSsnDuplicateError(
            ssnValue,
            index,
            formData.dependents,
            formData.ssn ?? ''
          );
          if (dupSsnMsg) {
            newErrors[`${prefix}ssn`] = dupSsnMsg;
            hasError = true;
          }
        }
      }

      if (!dependent.gender?.trim()) {
        newErrors[`${prefix}gender`] = 'Gender is required';
        hasError = true;
      }

      if (hasError) {
        invalidIndices.push(index);
      }
    });

    setErrors(newErrors);
    setInvalidDependentIndices(invalidIndices);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      setTimeout(() => {
        let errorElement: HTMLElement | null = null;

        if (invalidIndices.length > 0 && firstErrorKey.startsWith('dependent_')) {
          const dependentsSection = document.querySelector('[data-dependents-section]') as HTMLElement;
          if (dependentsSection) {
            dependentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        }

        if (firstErrorKey === 'preExistingConditionsAcknowledged') {
          errorElement = document.querySelector(`[name="preExistingConditions"]`) as HTMLElement;
        } else {
          errorElement = document.querySelector(`[name="${firstErrorKey}"]`) as HTMLElement;
        }

        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          errorElement.focus();
        }
      }, 100);
    }

    const isValid = Object.keys(newErrors).length === 0;
    if (isValid) {
      setInvalidDependentIndices([]);
    }
    return isValid;
  };

  const handleNext = () => {
    if (!validateStep1()) {
      return;
    }

    const directEnrollmentProduct = formData.products.find(p => p.id === 'care-plus');
    if (directEnrollmentProduct) {
      const directEnrollmentPricing = getDirectEnrollmentPricingOptions(formData.dob, formData.dependents);
      if (!directEnrollmentPricing.isAvailable) {
        setErrors({
          essentialPlan: directEnrollmentPricing.errorMessage || 'Invalid Direct Enrollment plan configuration',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!directEnrollmentProduct.selectedPlan) {
        setErrors({
          essentialPlan: 'Please select an IUA level for your Direct Enrollment membership',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!directEnrollmentProduct.extractedBenefitId) {
        setErrors({
          essentialPlan: 'Invalid IUA selection. Please select a valid IUA level.',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    saveStep(2);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    const answers = formData.questionnaireAnswers;

    if (!answers.zionPrinciplesAccept) newErrors.zionPrinciplesAccept = 'Please acknowledge Zion Principles';
    if (!answers.zionm1a) newErrors.zionm1a = 'This field is required';
    if (!answers.zionm1b) newErrors.zionm1b = 'This field is required';
    if (!answers.zionm1d) newErrors.zionm1d = 'This field is required';
    if (!answers.zionm1h) newErrors.zionm1h = 'This field is required';
    if (!answers.zionTimelySubmission) newErrors.zionTimelySubmission = 'This field is required';
    if (!answers.zionmh1) newErrors.zionmh1 = 'This field is required';
    if (!answers.zionmh2P) newErrors.zionmh2P = 'This field is required';
    if (!answers.zionmh2) newErrors.zionmh2 = 'This field is required';
    if (!answers.zionmh3.trim()) newErrors.zionmh3 = 'This field is required';
    if (!answers.medicalCostSharingAuth) newErrors.medicalCostSharingAuth = 'You must acknowledge and agree to the authorization';
    if (!answers.termsAndConditionsAccept) {
      newErrors.termsAndConditionsAccept = 'You must read and accept the Terms and Conditions';
    }

    if (!answers.signatureData) {
      newErrors.signatureData = 'Please draw your signature';
    }
    if (!(answers.typedSignature ?? '').trim()) {
      newErrors.typedSignature = 'Please type your full name';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      setTimeout(() => {
        const errorElement = document.querySelector(`[name="${firstErrorKey}"]`) as HTMLElement;
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          errorElement.focus();
        }
      }, 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleNextFromQuestionnaire = () => {
    if (!validateStep2()) {
      return;
    }
    saveStep(3);
    setErrors({});
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  };

  const handleBack = () => {
    if (response && (response.success === false || response.data?.SUCCESS === "false" || response.data?.TRANSACTION?.SUCCESS === "false")) {
      clearStorage();
    }
    if (currentStep === 3) {
      saveStep(2);
    } else if (currentStep === 2) {
      saveStep(1);
    }
    setErrors({});
    setResponse(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddSpouse = () => {
    const newDependent: Dependent = {
      firstName: '',
      lastName: '',
      dob: '',
      smoker: '',
      relationship: 'Spouse',
      address: '',
      city: '',
      state: '',
      zipcode: '',
      phone: '',
      ssn: '',
      gender: '',
      email: '',
    };

    // Reset Direct Enrollment plan selection when dependents change
    const updatedProducts = formData.products.map(product =>
      product.id === 'care-plus'
        ? { ...product, selectedPlan: '', extractedBenefitId: undefined, extractedPrice: undefined }
        : product
    );

    saveFormData({
      ...formData,
      dependents: [...formData.dependents, newDependent],
      products: updatedProducts
    });
  };

  const handleAddChild = () => {
    const newDependent: Dependent = {
      firstName: '',
      lastName: '',
      dob: '',
      smoker: '',
      relationship: 'Child',
      address: '',
      city: '',
      state: '',
      zipcode: '',
      phone: '',
      ssn: '',
      gender: '',
      email: '',
    };

    // Reset Direct Enrollment plan selection when dependents change
    const updatedProducts = formData.products.map(product =>
      product.id === 'care-plus'
        ? { ...product, selectedPlan: '', extractedBenefitId: undefined, extractedPrice: undefined }
        : product
    );

    saveFormData({
      ...formData,
      dependents: [...formData.dependents, newDependent],
      products: updatedProducts
    });
  };

  const handleChangeDependent = (index: number, field: keyof Dependent, value: string) => {
    const updatedDependents = [...formData.dependents];
    updatedDependents[index] = { ...updatedDependents[index], [field]: value };

    let updatedData = { ...formData, dependents: updatedDependents };

    if (field === 'dob') {
      const updatedProducts = formData.products.map(product =>
        product.id === 'care-plus'
          ? { ...product, selectedPlan: '', extractedBenefitId: undefined, extractedPrice: undefined }
          : product
      );
      updatedData = { ...updatedData, products: updatedProducts };
    }

    saveFormData(updatedData);

    const errorKey = `dependent_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
    if (field === 'dob' && errors.essentialPlan) {
      setErrors(prev => ({ ...prev, essentialPlan: '' }));
    }
  };

  const handleUpdateDependent = (index: number, dependent: Dependent) => {
    const updatedDependents = [...formData.dependents];
    updatedDependents[index] = dependent;
    saveFormData({ ...formData, dependents: updatedDependents });
  };

  const handleRemoveDependent = (index: number) => {
    const updatedDependents = formData.dependents.filter((_, i) => i !== index);

    // Reset Direct Enrollment plan selection when dependents change
    const updatedProducts = formData.products.map(product =>
      product.id === 'care-plus'
        ? { ...product, selectedPlan: '', extractedBenefitId: undefined, extractedPrice: undefined }
        : product
    );

    saveFormData({
      ...formData,
      dependents: updatedDependents,
      products: updatedProducts
    });

    const newErrors = { ...errors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`dependent_${index}_`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
  };

  const handleChangePlan = (productId: string, plan: string, extractedBenefitId?: string, extractedPrice?: number) => {
    const updatedProducts = formData.products.map(product =>
      product.id === productId ? { ...product, selectedPlan: plan, extractedBenefitId, extractedPrice } : product
    );
    saveFormData({ ...formData, products: updatedProducts });
  };

  const handleRemoveProduct = (productId: string) => {
    const updatedProducts = formData.products.filter(product => product.id !== productId);
    saveFormData({ ...formData, products: updatedProducts });
  };

  const handlePaymentChange = (field: keyof PaymentInfo, value: string) => {
    let updatedPayment = { ...formData.payment, [field]: value };

    if (field === 'paymentMethod') {
      updatedPayment.paymentType = value === 'ach' ? 'ACH' : value === 'list-bill' ? 'LB' : 'CC';
    }

    saveFormData({ ...formData, payment: updatedPayment });

    const errorKey = field;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const handleQuestionnaireChange = (field: keyof QuestionnaireAnswers, value: string | boolean) => {
    const updatedAnswers = { ...formData.questionnaireAnswers, [field]: value };
    saveFormData({ ...formData, questionnaireAnswers: updatedAnswers });

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /** Functional updates so sequential promo clears (Remove) cannot resurrect stale `promoCode` from closure. */
  const handlePromoCodeChange = (code: string) => {
    saveFormData(prev => ({ ...prev, promoCode: code }));
  };

  const handleAppliedPromoChange = (promo: AppliedPromo | null) => {
    saveFormData(prev => ({ ...prev, appliedPromo: promo }));
  };


  const syncZohoContact = async (requestBody: Record<string, unknown>, agentParam: string): Promise<string | null> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const zohoUrl = `${supabaseUrl}/functions/v1/zoho-sync-contact_direct`;
      const zohoPayload: Record<string, unknown> = {
        firstName: requestBody.firstName,
        lastName: requestBody.lastName,
        email: requestBody.email,
        phone: requestBody.phone,
        dob: requestBody.dob,
        address1: requestBody.address1,
        city: requestBody.city,
        state: requestBody.state,
        zipcode: requestBody.zipcode,
        ssn: requestBody.ssn,
        gender: requestBody.gender,
        effectiveDate: requestBody.effectiveDate,
        benefitId: requestBody.benefitId,
        selectedPrice: requestBody.selectedPrice,
        agentId: agentParam,
        dependents: (requestBody.dependents as Array<Record<string, unknown>>).map(dep => ({
          firstName: dep.firstName,
          lastName: dep.lastName,
          dob: dep.dob,
          relationship: dep.relationship,
          address: dep.address,
          city: dep.city,
          state: dep.state,
          zipcode: dep.zipcode,
          phone: dep.phone,
          ssn: dep.ssn,
          gender: dep.gender,
          email: dep.email,
        })),
      };
      const encryptedZoho = await encryptSensitiveFields(zohoPayload);
      if (encryptedZoho._encrypted) {
        encryptedZoho.encrypted = encryptedZoho._encrypted;
        delete encryptedZoho._encrypted;
      }
      const res = await fetch(zohoUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify(encryptedZoho),
      });
      if (res.ok) {
        const data = await res.json();
        return data.zohoContactId || null;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) {
      return;
    }

    setLoading(true);
    setResponse(null);
    sessionStorage.setItem('form_submitting', 'true');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const agentParam = formData.agent || agentId || '768413';
      const apiUrl = `${supabaseUrl}/functions/v1/enrollment-api-direct?id=${agentParam}`;
      /**
       * Reused across retries until the attempt completes. The edge function
       * de-duplicates member creation per submissionId so a re-submit or lost
       * response cannot create a second member, charge, or PDF.
       */
      const submissionId = getOrCreateSubmissionId();

      const directEnrollmentProduct = formData.products.find(p => p.id === 'care-plus');
      const benefitIdToSend = directEnrollmentProduct?.extractedBenefitId || formData.benefitId;
      const priceToSend = directEnrollmentProduct?.extractedPrice || 0;

      const requestBody = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dob: formData.dob,
        email: formData.email,
        smoker: formData.smoker,
        address1: formData.address1,
        city: formData.city,
        state: formData.state,
        zipcode: formData.zipcode,
        phone: formData.phone,
        ssn: formData.ssn,
        gender: formData.gender,
        agent: formData.agent,
        uniqueId: formData.uniqueId,
        effectiveDate: formData.effectiveDate,
        benefitId: benefitIdToSend,
        selectedPrice: priceToSend,
        dependents: formData.dependents.map(dep => ({
          firstName: dep.firstName,
          lastName: dep.lastName,
          dob: dep.dob,
          smoker: dep.smoker,
          relationship: dep.relationship,
          address: dep.address,
          city: dep.city,
          state: dep.state,
          zipcode: dep.zipcode,
          phone: dep.phone,
          ssn: dep.ssn,
          gender: dep.gender,
          email: dep.email,
        })),
        payment: formData.payment,
        pdid: formData.pdid,
        promoCode: formData.promoCode,
        referral: (formData.questionnaireAnswers?.referral || '').trim().slice(0, 24),
      };

      const zohoContactId = await syncZohoContact(requestBody as Record<string, unknown>, agentParam);

      let bodyString: string;
      try {
        const encryptedPayload = await encryptSensitiveFields(requestBody as Record<string, unknown>);
        if (zohoContactId) {
          (encryptedPayload as Record<string, unknown>).zohoContactId = zohoContactId;
        }
        bodyString = JSON.stringify(encryptedPayload);
      } catch {
        if (zohoContactId) {
          (requestBody as Record<string, unknown>).zohoContactId = zohoContactId;
        }
        bodyString = JSON.stringify(requestBody);
      }

      /**
       * Store the PDF in Supabase storage BEFORE enrolling so it is always
       * saved — even if the enrollment POST later times out. The 1Administration
       * API can be slow enough for the edge function to hit its ~150s wall-clock
       * limit and return 504 while the member is still created upstream; gating
       * PDF storage on that response would mean no PDF is ever saved. The
       * agreement PDF is built from form data, so it needs neither the member id
       * nor a submissionId. Omitting submissionId keeps the row out of the
       * 'pdf_stored' state, so the shared retry cron never auto-attaches it.
       */
      setFinishingEnrollment(true);
      try {
        await generateAndUploadPDF(null);
      } catch {
        // PDF is best-effort; never block the enrollment on a storage failure.
      }
      setFinishingEnrollment(false);

      /**
       * Fire the enrollment POST exactly once — no auto-retry. Retrying a slow
       * or timed-out enrollment is what creates duplicate members. The
       * client-side timeout mirrors the edge function's ~150s wall-clock limit.
       */
      const ENROLL_TIMEOUT_MS = 150000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ENROLL_TIMEOUT_MS);

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'X-Submission-Id': submissionId,
          },
          cache: 'no-store',
          body: bodyString,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Invalid response from server: ${text.substring(0, 100)}`);
        }

        const data = await res.json();

        if (res.status === 409) {
          /**
           * The server's idempotency gate already has this submission in flight
           * (a prior click is still creating the member). Don't re-POST; recover
           * the memberId from the submission record if it's already enrolled,
           * otherwise tell the user to wait rather than resubmit.
           */
          const statusResult = await fetchSubmissionStatus(submissionId, agentParam);
          if (statusResult?.memberId) {
            setMemberId(statusResult.memberId);
            clearSubmissionId();
            // Snapshot the List Bill decision BEFORE clearStorage() resets formData.
            setListBillSummary(
              formData.payment.paymentMethod === 'list-bill' ? { productName: 'Direct' } : null,
            );
            setShowThankYou(true);
            clearStorage();
            sendAdvisorNotification(agentParam).catch(() => {});
            setLoading(false);
            return;
          }
          setResponse({
            success: false,
            status: 409,
            error: 'Enrollment already in progress',
            message: 'This enrollment is already being processed. Please wait a moment and check your email before trying again.',
          });
          clearFormDataOnly();
          setLoading(false);
          return;
        }

        const txVal = data.data?.TRANSACTION?.SUCCESS;
        const topVal = data.data?.SUCCESS;

        const txFailed =
          txVal === false ||
          txVal === "false" ||
          (typeof txVal === 'string' && txVal.toLowerCase() === 'false');

        const topLevelFailed =
          topVal === false ||
          topVal === "false" ||
          (typeof topVal === 'string' && topVal.toLowerCase() === 'false');

        const txConfirmed =
          txVal === true ||
          txVal === "true" ||
          (typeof txVal === 'string' && txVal.toLowerCase() === 'true');

        const topConfirmed =
          data.success === true &&
          (topVal === "true" ||
            (typeof topVal === 'string' && topVal.toLowerCase() === 'true'));

        const isHandledStatus = res.ok || res.status === 400;

        if (!isHandledStatus || txFailed || topLevelFailed) {
          // Clear failure (declined card, hard validation error, 5xx, etc.).
          setResponse(data);
          clearFormDataOnly();
          setLoading(false);
          return;
        }

        if (!txConfirmed && !topConfirmed) {
          setResponse({
            success: false,
            status: data.status || res.status,
            data: data.data,
            error: 'Enrollment could not be confirmed',
            message: 'The enrollment response was ambiguous. Please contact support.',
          });
          clearFormDataOnly();
          setLoading(false);
          return;
        }

        // Success — the PDF was already stored above.
        const memberCandidates = [
          data.data?.MEMBER?.ID,
          data.data?.TRANSACTION?.MEMBER?.ID,
          data.data?.TRANSACTION?.MEMBERID,
          data.data?.MEMBERID,
          data.data?.ID,
        ];
        const enrolledMemberId = memberCandidates
          .map(v => (v != null ? String(v).trim() : ''))
          .find(v => v.length > 0) || null;
        setMemberId(enrolledMemberId);
        clearSubmissionId();
        // Snapshot the List Bill decision BEFORE clearStorage() resets formData.
        setListBillSummary(
          formData.payment.paymentMethod === 'list-bill' ? { productName: 'Direct' } : null,
        );
        setShowThankYou(true);
        clearStorage();
        sendAdvisorNotification(agentParam).catch(() => {});
        setLoading(false);
        return;
      } catch (error) {
        clearTimeout(timeoutId);
        /**
         * Timeout / network error: the member may have been created upstream and
         * the PDF is already stored. Do NOT retry (that is what causes duplicate
         * members); show a clear "processing — do not resubmit" message.
         */
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';
        setResponse({
          success: true,
          status: 202,
          data: { TRANSACTION: { SUCCESS: true } },
          message: isTimeout
            ? 'Your enrollment is taking longer than usual and is still being processed. Please do NOT resubmit — our team will confirm your enrollment shortly.'
            : 'Your enrollment is being processed. Please do NOT resubmit — if you do not receive a confirmation, our team will follow up shortly.',
        });
        clearFormDataOnly();
        setLoading(false);
        return;
      }
    } finally {
      sessionStorage.removeItem('form_submitting');
    }
  };

  const sendAdvisorNotification = async (salesId: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const notificationUrl = `${supabaseUrl}/functions/v1/send-advisor-notification`;

      const response = await fetch(notificationUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Cache-Control': 'no-cache, no-store',
        },
        cache: 'no-store',
        body: JSON.stringify({
          salesId,
          customerFirstName: formData.firstName,
          customerLastName: formData.lastName,
          customerEmail: formData.email,
          planName: 'Direct Enrollment',
        }),
      });

      await response.json();
    } catch (error) {
    }
  };

  const generateAndUploadPDF = async (enrollmentMemberId: string | null) => {
    try {
      const pdfBlob = await generateEnrollmentPDF(formData);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const pdfApiUrl = `${supabaseUrl}/functions/v1/save-enrollment-pdf`;


      const formDataUpload = new FormData();
      formDataUpload.append('pdf', pdfBlob, 'enrollment.pdf');
      formDataUpload.append('email', formData.email);
      formDataUpload.append('metadata', JSON.stringify({
        firstName: formData.firstName,
        lastName: formData.lastName,
        benefitId: formData.benefitId,
        enrollmentDate: new Date().toISOString(),
        enrollmentMemberId,
      }));

      const pdfResponse = await fetch(pdfApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Cache-Control': 'no-cache, no-store',
        },
        cache: 'no-store',
        body: formDataUpload,
      });


      const contentType = pdfResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await pdfResponse.text();
        throw new Error('PDF upload returned invalid response');
      }

      const pdfResult = await pdfResponse.json();

      if (pdfResult.success && pdfResult.pdfUrl) {
        setPdfUrl(pdfResult.pdfUrl);
        /**
         * The PDF is intentionally NOT auto-forwarded to the enrollment123
         * gateway. It is stored in Supabase storage (and surfaced on the
         * thank-you page) so it can be downloaded and uploaded manually to
         * 1Administration — this guarantees enrollment can never be triggered
         * automatically a second time.
         */
      } else {
        throw new Error(pdfResult.error || 'PDF upload failed');
      }
    } catch (error) {
      throw error;
    }
  };

  if (showThankYou) {
    return <ThankYouPage enrollmentData={{ firstName: formData.firstName, email: formData.email }} pdfUrl={pdfUrl} listBill={listBillSummary} />;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-2 py-4 xs:p-6">
      <div className="bg-white rounded-lg shadow-lg px-3 py-6 xs:p-8">
        <div className="mb-8 text-center">
          <img src="/assets/MPB-Health-No-background.png" alt="MPB Health Logo" className="h-16 xs:h-20 w-auto mx-auto mb-4" />
          <h1 className="text-xl xs:text-2xl md:text-3xl font-bold text-gray-900">Direct Enrollment</h1>
        </div>

        <ProgressIndicator currentStep={currentStep} totalSteps={3} />

        <form onSubmit={(e) => e.preventDefault()} autoComplete="off">
          {currentStep === 1 && (
            <Step1PersonalInfo
              formData={formData}
              errors={errors}
              onChange={handleChange}
              onNext={handleNext}
              onAddSpouse={handleAddSpouse}
              onAddChild={handleAddChild}
              onChangeDependent={handleChangeDependent}
              onRemoveDependent={handleRemoveDependent}
              onChangePlan={handleChangePlan}
              onRemoveProduct={handleRemoveProduct}
              onBenefitIdChange={onBenefitIdChange}
              onPromoCodeChange={handlePromoCodeChange}
              onAppliedPromoChange={handleAppliedPromoChange}
            />
          )}

          {currentStep === 2 && (
            <Step2Questionnaire
              formData={formData}
              errors={errors}
              onNext={handleNextFromQuestionnaire}
              onBack={handleBack}
              onQuestionnaireChange={handleQuestionnaireChange}
            />
          )}

          {currentStep === 3 && (
            <Step2AddressInfo
              formData={formData}
              errors={errors}
              onChange={handleChange}
              onBack={handleBack}
              onSubmit={handleSubmit}
              loading={loading}
              finishingEnrollment={finishingEnrollment}
              response={response}
              onUpdateDependent={handleUpdateDependent}
              onPaymentChange={handlePaymentChange}
              onClearError={handleClearError}
              invalidDependentIndices={invalidDependentIndices}
              employeeGroup={employeeGroup}
            />
          )}
        </form>
      </div>
    </div>
  );
}
