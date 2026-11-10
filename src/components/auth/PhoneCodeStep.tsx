/**
 * The WhatsApp code step (NE-01a, AD-4): the email-code screen body (`VerificationCodeForm`) with WhatsApp wording, fed by `usePhoneVerification`.
 */
import React from 'react';

import type { PhoneVerification } from '../../hooks/usePhoneVerification';
import { useT } from '../../labels/LabelsContext';
import VerificationCodeForm from './VerificationCodeForm';

export default function PhoneCodeStep({ otp }: { otp: PhoneVerification }): React.JSX.Element {
  const t = useT();
  return (
    <VerificationCodeForm
      title={t('mob.otp.title')}
      instructions={t('mob.otp.instructions')}
      target={otp.target}
      codePlaceholder={t('mob.verify.code_placeholder')}
      code={otp.code}
      onChangeCode={otp.setCode}
      verifyLabel={t('mob.otp.verify')}
      onVerify={otp.verify}
      isVerifying={otp.isVerifying}
      resendLabel={otp.cooldown > 0 ? t('mob.otp.resend_cooldown', { seconds: otp.cooldown }) : t('mob.otp.resend')}
      onResend={otp.resend}
      isResending={otp.isResending}
      resendDisabled={otp.cooldown > 0 || otp.isResending || otp.isVerifying}
      backLabel={t('mob.common.back')}
      onBack={otp.back}
      retryLabel={t('mob.common.retry')}
      error={otp.error}
      info={otp.info}
      retryError={otp.retryError}
      retryAction={otp.retryAction}
      focusSignal={otp.focusSignal}
    />
  );
}
