import { SUFFIXES, type Suffix } from '@verzus/schemas/account';
import { isPhMobile, phMobileInput } from '@verzus/schemas/phone';
import { AuthField, authInput } from './AuthCard';

/** A venue owner's name and mobile number: registration, and fixing them after a rejection. */
export interface OwnerForm {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: Suffix | '';
  /** The 10 digits after +63, as typed. */
  phone: string;
}

export const emptyOwnerForm: OwnerForm = { firstName: '', middleName: '', lastName: '', suffix: '', phone: '' };

export function ownerFormProblems(f: OwnerForm) {
  return {
    firstName: f.firstName.trim() ? null : 'Enter your first name.',
    lastName: f.lastName.trim() ? null : 'Enter your last name.',
    phone: isPhMobile(f.phone) ? null : 'Enter the 10 digits of your mobile number.',
  };
}

export function OwnerDetailsFields(props: {
  value: OwnerForm;
  onChange: (f: OwnerForm) => void;
  /** Show what's missing (after the person tried to continue). */
  showProblems: boolean;
}) {
  const f = props.value;
  const set = (patch: Partial<OwnerForm>) => props.onChange({ ...f, ...patch });
  const p = ownerFormProblems(f);
  const show = (k: keyof typeof p) => (props.showProblems ? p[k] : null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <AuthField label="First name" problem={show('firstName')}>
          <input
            autoComplete="given-name"
            maxLength={60}
            className={authInput}
            aria-invalid={Boolean(show('firstName'))}
            value={f.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
          />
        </AuthField>
        <AuthField label="Last name" problem={show('lastName')}>
          <input
            autoComplete="family-name"
            maxLength={60}
            className={authInput}
            aria-invalid={Boolean(show('lastName'))}
            value={f.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
          />
        </AuthField>
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <AuthField label="Middle name (optional)">
          <input
            autoComplete="additional-name"
            maxLength={60}
            className={authInput}
            value={f.middleName}
            onChange={(e) => set({ middleName: e.target.value })}
          />
        </AuthField>
        <AuthField label="Suffix">
          <select className={authInput} value={f.suffix} onChange={(e) => set({ suffix: e.target.value as Suffix | '' })}>
            <option value="">None</option>
            {SUFFIXES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </AuthField>
      </div>
      <AuthField label="Mobile number" problem={show('phone')} hint="For verzus only, to reach you about your venue.">
        <span
          className={`flex items-center gap-2 rounded-control border-2 bg-surface px-3 focus-within:border-violet ${
            show('phone') ? 'border-danger' : 'border-line-strong'
          }`}
        >
          <span className="font-bold text-violet">+63</span>
          {/* No maxLength: autofill and paste bring "0917…" or "+63 917…", which phMobileInput trims. */}
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="9XX XXX XXXX"
            className="w-full min-w-0 bg-transparent py-2 text-fg placeholder:text-fg-3 focus:outline-none"
            value={f.phone}
            onChange={(e) => set({ phone: phMobileInput(e.target.value) })}
          />
        </span>
      </AuthField>
    </>
  );
}
