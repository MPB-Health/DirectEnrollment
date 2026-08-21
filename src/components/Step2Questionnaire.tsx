import { FileText, ArrowLeft, PenTool } from 'lucide-react';
import { FormData } from '../hooks/useEnrollmentStorage';
import { useRef, useState, useEffect } from 'react';
import { TermsAndConditionsFormatted } from './TermsAndConditionsFormatted';

interface QuestionnaireAnswers {
  zionPrinciplesAccept: string;
  zionm1a: string;
  zionm1b: string;
  zionm1d: string;
  zionm1h: string;
  zionTimelySubmission: string;
  zionmh1: string;
  zionmh2P: string;
  zionmh2: string;
  zionmh3: string;
  primaryMedicalTreatments: string;
  spouseMedicalConditions: string;
  dependentMedicalConditions: string;
  medicalCostSharingAuth: boolean;
  termsAndConditionsAccept: boolean;
  signatureData: string;
  typedSignature: string;
  referral: string;
}

interface Step2QuestionnaireProps {
  formData: FormData;
  errors: Record<string, string>;
  onNext: () => void;
  onBack: () => void;
  onQuestionnaireChange: (field: keyof QuestionnaireAnswers, value: string | boolean) => void;
}

export default function Step2Questionnaire({
  formData,
  errors,
  onNext,
  onBack,
  onQuestionnaireChange,
}: Step2QuestionnaireProps) {
  const answers = formData.questionnaireAnswers;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const allStrokesRef = useRef<{ x: number; y: number }[][]>([]);

  useEffect(() => {
    if (answers.signatureData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          setHasDrawnSignature(true);
        };
        img.src = answers.signatureData;
      }
    }
  }, []);

  const handleRadioChange = (field: keyof QuestionnaireAnswers, value: string | boolean) => {
    onQuestionnaireChange(field, value);
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return { x, y };
  };

  const drawSmoothCurve = (points: { x: number; y: number }[]) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 2; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    if (points.length > 1) {
      ctx.quadraticCurveTo(
        points[points.length - 2].x,
        points[points.length - 2].y,
        points[points.length - 1].x,
        points[points.length - 1].y
      );
    }

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const { x, y } = getCanvasCoordinates(e);
    pointsRef.current = [{ x, y }];

    setIsDrawing(true);
    setHasDrawnSignature(true);
  };

  const redrawAllStrokes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    allStrokesRef.current.forEach(stroke => {
      drawSmoothCurve(stroke);
    });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    pointsRef.current.push({ x, y });

    redrawAllStrokes();
    drawSmoothCurve(pointsRef.current);
  };

  const smoothSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      if (pointsRef.current.length > 0) {
        allStrokesRef.current.push([...pointsRef.current]);
        pointsRef.current = [];
      }
      smoothSignature();
      const signatureData = canvasRef.current.toDataURL('image/png');
      onQuestionnaireChange('signatureData', signatureData);
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pointsRef.current = [];
    allStrokesRef.current = [];
    onQuestionnaireChange('signatureData', '');
    setHasDrawnSignature(false);
  };

  return (
    <div className="space-y-8">
      <fieldset className="border border-gray-300 rounded-lg p-6 space-y-6">
        <legend className="text-xl font-semibold text-gray-800 px-2">
          <FileText className="w-5 h-5 inline mr-2 text-blue-600" />
          Membership Principles
        </legend>

        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 mb-2">
              Understanding Zion HealthShare Principles of Membership
              <span className="text-red-500 ml-1">*</span>
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              Adherence to the Zion HealthShare Principles of Membership minimizes medical risks, encourages good health practices, and ensures member integrity and accountability. Our members must comply with certain requirements to maintain membership and remain eligible to participate in our medical cost sharing community. Zion HealthShare members are expected to act with honor and integrity. Members should not falsify a sharing request, medical records, or use other deceptive practices. If a member abuses the trust of our community, their membership may be revoked or withdrawn.
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionPrinciplesAccept"
                  value="Y"
                  checked={answers.zionPrinciplesAccept === 'Y'}
                  onChange={(e) => handleRadioChange('zionPrinciplesAccept', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">I accept Zion Principles</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionPrinciplesAccept"
                  value="N"
                  checked={answers.zionPrinciplesAccept === 'N'}
                  onChange={(e) => handleRadioChange('zionPrinciplesAccept', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">I don't accept Zion Principles</span>
              </label>
            </div>
            {errors.zionPrinciplesAccept && (
              <p className="mt-2 text-sm text-red-500">{errors.zionPrinciplesAccept}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 mb-2">
              1. I believe that a community of ethical, health-conscious people can most effectively care for one another by directly sharing the costs associated with each other's healthcare needs. I acknowledge that Zion HealthShare affiliates itself with, and considers itself accountable to, a higher power. I recognize that Zion HealthShare welcomes members of all faiths.
              <span className="text-red-500 ml-1">*</span>
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1a"
                  value="Y"
                  checked={answers.zionm1a === 'Y'}
                  onChange={(e) => handleRadioChange('zionm1a', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1a"
                  value="N"
                  checked={answers.zionm1a === 'N'}
                  onChange={(e) => handleRadioChange('zionm1a', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionm1a && <p className="mt-2 text-sm text-red-500">{errors.zionm1a}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              2. I understand that Zion HealthShare is a benevolent organization, not an insurance entity, and that Zion HealthShare cannot guarantee payment of medical expenses.
              <span className="text-red-500 ml-1">*</span>
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1b"
                  value="Y"
                  checked={answers.zionm1b === 'Y'}
                  onChange={(e) => handleRadioChange('zionm1b', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1b"
                  value="N"
                  checked={answers.zionm1b === 'N'}
                  onChange={(e) => handleRadioChange('zionm1b', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionm1b && <p className="mt-2 text-sm text-red-500">{errors.zionm1b}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              3. I will practice good health measures and strive for a balanced lifestyle. I agree to abstain from the use of any illicit or illegal drugs and refrain from excessive alcohol consumption, acts which are harmful to the body. Note: Failure to report tobacco use results in a one-time $500 fee, and cost sharing will be paused until this is paid.
              <span className="text-red-500 ml-1">*</span>
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1d"
                  value="Y"
                  checked={answers.zionm1d === 'Y'}
                  onChange={(e) => handleRadioChange('zionm1d', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1d"
                  value="N"
                  checked={answers.zionm1d === 'N'}
                  onChange={(e) => handleRadioChange('zionm1d', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionm1d && <p className="mt-2 text-sm text-red-500">{errors.zionm1d}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              4. I am obligated to care for my family. I believe that mental, physical, emotional, or other abuse of a family member, or any other person, is morally wrong. I am committed to always treating my family and others with care and respect.
              <span className="text-red-500 ml-1">*</span>
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1h"
                  value="Y"
                  checked={answers.zionm1h === 'Y'}
                  onChange={(e) => handleRadioChange('zionm1h', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionm1h"
                  value="N"
                  checked={answers.zionm1h === 'N'}
                  onChange={(e) => handleRadioChange('zionm1h', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionm1h && <p className="mt-2 text-sm text-red-500">{errors.zionm1h}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              5. I agree to submit to mediation followed by subsequent binding arbitration, if needed, for any instance of a dispute with Zion HealthShare or its affiliates.
              <span className="text-red-500 ml-1">*</span>
            </p>
            <p className="text-sm text-gray-700 mb-3">
              It is the members responsibility to ensure all medical bills submitted for sharing are submitted within 6 months of the date of service
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionTimelySubmission"
                  value="Y"
                  checked={answers.zionTimelySubmission === 'Y'}
                  onChange={(e) => handleRadioChange('zionTimelySubmission', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionTimelySubmission"
                  value="N"
                  checked={answers.zionTimelySubmission === 'N'}
                  onChange={(e) => handleRadioChange('zionTimelySubmission', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionTimelySubmission && (
              <p className="mt-2 text-sm text-red-500">{errors.zionTimelySubmission}</p>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 rounded-lg p-6 space-y-6">
        <legend className="text-xl font-semibold text-gray-800 px-2">Health History</legend>

        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 mb-2">
              Understanding of Pre-Existing Conditions.
              <span className="text-red-500 ml-1">*</span>
            </p>
            <p className="text-sm text-gray-700 mb-3">
              I understand that medical needs that result from a condition that existed prior to membership are only shareable if the condition was regarded as cured and did not require treatment or present symptoms for 24 months prior to the membership start date. This applies even if the member was only examined, diagnosed, or took medication for the condition within that 24-month window.
            </p>
            <p className="text-sm mb-3" style={{ color: '#9b0000' }}>
              Examples of pre-existing conditions include but are not limited to: arthritis, cancer, degenerative conditions, diabetes, and heart conditions. High blood pressure, high cholesterol, and diabetes (types 1 and 2) are exceptions if they have not required hospitalization in the last 12 months and are controlled via diet or medication. For detailed information, refer to the{' '}
              <a
                href="/assets/Member-Guidelines_01.2026.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
                style={{ color: '#9b0000' }}
              >
                Member Guidelines
              </a>.
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionmh1"
                  value="Y"
                  checked={answers.zionmh1 === 'Y'}
                  onChange={(e) => handleRadioChange('zionmh1', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionmh1"
                  value="N"
                  checked={answers.zionmh1 === 'N'}
                  onChange={(e) => handleRadioChange('zionmh1', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionmh1 && <p className="mt-2 text-sm text-red-500">{errors.zionmh1}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              IMPORTANT! Limitations on Maternity and Delivery Needs
              <span className="text-red-500 ml-1">*</span>
            </p>
            <p className="text-sm text-gray-700 mb-2">
              I understand Maternity sharing requests have a structured Initial Unshareable Amount (IUA) as follows:
            </p>
            <ul className="text-sm text-gray-700 mb-2 space-y-1 list-disc list-inside">
              <li>Household Membership IUA: $1,250 (Standard Maternity IUA: $2,500)</li>
              <li>Household Membership IUA: $2,500 (Standard Maternity IUA: $2,500)</li>
              <li>Household Membership IUA: $5,000 (Standard Maternity IUA: $5,000)</li>
            </ul>
            <p className="text-sm text-gray-700 mb-3">
              Expenses eligible for sharing may include prenatal care, postnatal care, and delivery. Any newborn expenses incurred after delivery are subject to a separate sharing request and IUA. The maternity sharing request and all itemized bills must be submitted within six (6) months of the date of service.
            </p>
            <p className="text-sm font-semibold mb-1" style={{ color: '#9b0000' }}>MATERNITY - WAITING PERIOD</p>
            <p className="text-sm mb-3" style={{ color: '#9b0000' }}>
              Maternity sharing requests are ineligible for sharing during the first six (6) months of membership. To be eligible, the conception date must occur after six (6) months of continuous membership, as confirmed by medical records. Household memberships with a start date before April 1, 2025, are NOT subject to this waiting period. Household memberships enrolled through a company or employer are also NOT subject to the six (6)-month waiting period.
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionmh2P"
                  value="Y"
                  checked={answers.zionmh2P === 'Y'}
                  onChange={(e) => handleRadioChange('zionmh2P', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionmh2P"
                  value="N"
                  checked={answers.zionmh2P === 'N'}
                  onChange={(e) => handleRadioChange('zionmh2P', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionmh2P && <p className="mt-2 text-sm text-red-500">{errors.zionmh2P}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              Understanding of Limitations on Pre-Existing Conditions
              <span className="text-red-500 ml-1">*</span>
            </p>
            <p className="text-sm text-gray-700 mb-2">
              I understand that Pre-existing conditions have a waiting or phase in period. Zion Health attempts to negotiate all medical bills received and many membership types include the PHCS network for pre-negotiated medical expenses.
            </p>
            <p className="text-sm mb-3" style={{ color: '#9b0000' }}>
              1st Year of Membership – Waiting period of all pre-existing conditions. 2nd Year of Membership – Up to $25,000 of sharing for pre-existing conditions. 3rd Year of Membership – Up to $50,000 of sharing for pre-existing conditions. 4th Year of Membership and Beyond – Up to $125,000 of sharing for pre-existing conditions.
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionmh2"
                  value="Y"
                  checked={answers.zionmh2 === 'Y'}
                  onChange={(e) => handleRadioChange('zionmh2', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">YES</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="zionmh2"
                  value="N"
                  checked={answers.zionmh2 === 'N'}
                  onChange={(e) => handleRadioChange('zionmh2', e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">NO</span>
              </label>
            </div>
            {errors.zionmh2 && <p className="mt-2 text-sm text-red-500">{errors.zionmh2}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              Primary Member Medical Conditions
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Has the primary member experienced symptoms of, been diagnosed with, or been treated for any condition within the past 24 months?
            </p>
            <p className="text-sm text-gray-600 mb-3">
              *Note: A $25.00 annual fee is charged at the time of enrollment and each year thereafter. This fee covers your membership in the MPowering Benefits Association.
            </p>
            <p className="text-sm mb-2" style={{ color: '#9b0000' }}>
             Add conditions below. For multiple conditions, please add one per line. (If there are no conditions present, you may leave this blank)
            </p>

            <textarea
              name="zionmh3"
              value={answers.zionmh3}
              onChange={(e) => handleRadioChange('zionmh3', e.target.value)}
              rows={3}
              maxLength={255}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                errors.zionmh3 ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter medical conditions or leave blank if not applicable"
            />
            {errors.zionmh3 && <p className="mt-2 text-sm text-red-500">{errors.zionmh3}</p>}
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">
              Primary Medical Treatments
            </p>
            <p className="text-sm text-gray-700 mb-2">
              If you have answered Yes please provide the date the treatment occurred and what type of treatment you received and/or the specific genetic defect / hereditary disease - one item per line.
            </p>
            <p className="text-sm text-gray-600 mb-3 italic">
              EXAMPLE: January 2018 abdominal hernia surgery
            </p>

            <textarea
              name="primaryMedicalTreatments"
              value={answers.primaryMedicalTreatments}
              onChange={(e) => handleRadioChange('primaryMedicalTreatments', e.target.value)}
              rows={4}
              maxLength={500}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                errors.primaryMedicalTreatments ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter treatment details or leave blank if not applicable"
            />
            {errors.primaryMedicalTreatments && <p className="mt-2 text-sm text-red-500">{errors.primaryMedicalTreatments}</p>}
          </div>

          {formData.dependents.some(dep => dep.relationship === 'Spouse') && (
            <div>
              <p className="font-semibold text-gray-900 mb-2">
                Spouse's Medical Conditions
              </p>
              <p className="text-sm text-gray-700 mb-2">
                Has the primary member's spouse experienced symptoms of, been diagnosed with, or been treated for any condition within the past 24 months?
              </p>
              <p className="text-sm mb-2" style={{ color: '#9b0000' }}>
                Add conditions below. For multiple conditions, please add one per line. (If there are no conditions present, you may leave this blank)
              </p>

              <textarea
                name="spouseMedicalConditions"
                value={answers.spouseMedicalConditions}
                onChange={(e) => handleRadioChange('spouseMedicalConditions', e.target.value)}
                rows={3}
                maxLength={255}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                  errors.spouseMedicalConditions ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter spouse medical conditions or leave blank if not applicable"
              />
              {errors.spouseMedicalConditions && <p className="mt-2 text-sm text-red-500">{errors.spouseMedicalConditions}</p>}
            </div>
          )}

          {formData.dependents.some(dep => dep.relationship === 'Child') && (
            <div>
              <p className="font-semibold text-gray-900 mb-2">
                Dependent(s) Medical Conditions
              </p>
              <p className="text-sm text-gray-700 mb-2">
                Has the dependent(s) experienced symptoms of, been diagnosed with, or been treated for any condition within the past 24 months?
              </p>
              <p className="text-sm mb-2" style={{ color: '#9b0000' }}>
                Add conditions below. For multiple conditions, please add one per line. (If there are no conditions present, you may leave this blank)
              </p>

              <textarea
                name="dependentMedicalConditions"
                value={answers.dependentMedicalConditions}
                onChange={(e) => handleRadioChange('dependentMedicalConditions', e.target.value)}
                rows={3}
                maxLength={255}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                  errors.dependentMedicalConditions ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter dependent medical conditions or leave blank if not applicable"
              />
              {errors.dependentMedicalConditions && <p className="mt-2 text-sm text-red-500">{errors.dependentMedicalConditions}</p>}
            </div>
          )}

          <div>
            <p className="font-semibold text-gray-900 mb-3">
            Medical Cost Sharing/Health Share Authorization
              <span className="text-red-500 ml-1">*</span>
            </p>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 leading-relaxed">
              Medical Cost Sharing/Health Share is not insurance or an insurance policy nor is it offered through an insurance company. Medical Cost Sharing/Health Share is not a discount healthcare program nor a discount health card program. Whether anyone chooses to assist you with your medical bills will be totally voluntary, as neither the organization nor any other member is liable for or may be compelled to make the payment of your medical bill. As such, medical cost Sharing/health share should never be considered to be insurance. Whether you receive any amounts for medical expenses and whether or not medical cost sharing/health share continues to operate, you are always personally responsible for the payment of your own medical bills. Medical Cost Sharing/Health Share is not subject to the regulatory requirements or consumer protections of your particular State's Insurance Code or Statutes.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="medicalCostSharingAuth"
                checked={answers.medicalCostSharingAuth}
                onChange={(e) => onQuestionnaireChange('medicalCostSharingAuth', e.target.checked as any)}
                className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              />
              <span className="text-sm text-gray-700">
                By checking this box, I acknowledge that I understand and agree to the authorization
              </span>
            </label>
            {errors.medicalCostSharingAuth && (
              <p className="mt-2 text-sm text-red-500">{errors.medicalCostSharingAuth}</p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-4">
            <p className="font-semibold text-gray-900">
              Terms and Conditions
              <span className="text-red-500 ml-1">*</span>
            </p>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
              <div
                role="region"
                aria-label="Terms and Conditions full text"
                className="max-h-[min(17.5rem,42vh)] sm:max-h-[min(18rem,40vh)] overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
              >
                <TermsAndConditionsFormatted />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="termsAndConditionsAccept"
                checked={answers.termsAndConditionsAccept}
                onChange={(e) => onQuestionnaireChange('termsAndConditionsAccept', e.target.checked)}
                className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              />
              <span className="text-sm text-gray-700">
                I have read and accept the Terms and Conditions
              </span>
            </label>
            {errors.termsAndConditionsAccept && (
              <p className="mt-2 text-sm text-red-500">{errors.termsAndConditionsAccept}</p>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 rounded-lg p-6 space-y-6 mt-6">
        <legend className="text-xl font-semibold text-gray-800 px-2">Referral</legend>
        <p className="font-semibold text-gray-900 mb-3">
          Add A Referral Or Leave It Blank
        </p>
        <input
          type="text"
          name="referral"
          value={answers.referral}
          onChange={(e) => handleRadioChange('referral', e.target.value)}
          placeholder="Type referral name"
          maxLength={24}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-serif text-lg ${
            errors.referral ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.referral && (
          <p className="mt-2 text-sm text-red-500">{errors.referral}</p>
        )}
      </fieldset>

      <fieldset className="border border-gray-300 rounded-lg p-6 space-y-6">
        <legend className="text-xl font-semibold text-gray-800 px-2">
          <PenTool className="w-5 h-5 inline mr-2 text-blue-600" />
          Signature
        </legend>

        <div className="space-y-6">
          <div>
            <p className="font-semibold text-gray-900 mb-3">
              Draw Your Signature
              <span className="text-red-500 ml-1">*</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Use your mouse or finger to sign in the box below. Click "Clear" to start over if needed.
            </p>

            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                name="signatureData"
                width={600}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full cursor-crosshair touch-none"
                style={{ maxWidth: '100%', height: 'auto', aspectRatio: '3/1' }}
              />
            </div>

            <button
              type="button"
              onClick={clearSignature}
              disabled={!hasDrawnSignature}
              className="mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 font-medium rounded-lg transition duration-200"
            >
              Clear Signature
            </button>

            {errors.signatureData && (
              <p className="mt-2 text-sm text-red-500">{errors.signatureData}</p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <p className="font-semibold text-gray-900 mb-3">
              Type Your Full Name
              <span className="text-red-500 ml-1">*</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Please type your full name below to accompany your drawn signature. Both are required to complete your enrollment.
            </p>

            <input
              type="text"
              name="typedSignature"
              value={answers.typedSignature}
              onChange={(e) => handleRadioChange('typedSignature', e.target.value)}
              placeholder="Type your full name"
              maxLength={24}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-serif text-lg ${
                errors.typedSignature ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.typedSignature && (
              <p className="mt-2 text-sm text-red-500">{errors.typedSignature}</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Both your drawn signature and typed name are required to continue with your enrollment.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="pt-6 flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Previous Page
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
        >
          Continue to Enrollment Details
        </button>
      </div>
    </div>
  );
}
