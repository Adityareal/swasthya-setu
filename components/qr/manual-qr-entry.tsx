'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * QR_Module — the card number, typed (Req 18.3, 18.5).
 *
 * BUILT AT THE SAME TIME AS THE CAMERA, NOT AFTER IT, AND SHARING ITS EXACT
 * RESOLUTION PATH. `onSubmit` feeds the same `submit` event into the same
 * reducer that a decoded frame feeds, so a typed id and a scanned id cannot
 * resolve differently — there is one lookup, reached two ways.
 *
 * It exists because the camera is not a dependency this feature is allowed to
 * have. `getUserMedia` requires a secure context, so a phone pointed at a
 * laptop's LAN IP over plain HTTP gets nothing. Permission can be denied, and once
 * denied on Android it stays denied without a trip into system settings. A device
 * may have no rear camera. A card may be creased past the point where error
 * correction recovers it. Every one of those ends here, and Req 18.5 requires
 * patient selection to stay completable regardless — so this field is ALWAYS
 * rendered, never conditionally, and the camera is the accelerator rather than the
 * mechanism.
 *
 * `autoCapitalize="characters"` and `spellCheck={false}` because `SS-WRD-KAMLA-7F3A`
 * is not a word, and an Android keyboard left to its own devices will lowercase
 * it, autocorrect it, and offer to complete it.
 */
export function ManualQrEntry({
  onSubmit,
  busy = false,
  /** `true` when no camera is running, which makes this the only path — the plate
   *  takes the wayfinding rail so the eye lands here rather than on a dead
   *  viewfinder. */
  primary = false,
}: {
  onSubmit: (value: string) => void;
  busy?: boolean;
  primary?: boolean;
}) {
  const { t, locale } = useT();
  const [value, setValue] = useState('');

  function submit() {
    const trimmed = value.trim();
    if (trimmed === '' || busy) return;
    onSubmit(trimmed);
    /* Cleared on submit, so a miss followed by a second attempt starts from an
       empty field instead of asking the user to select and delete a wrong id
       one-handed. The value that missed is echoed by the not-found plate. */
    setValue('');
  }

  return (
    <Plate {...(primary ? { state: 'action' as const } : {})} className="p-4" as="section">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label
          htmlFor="qr-manual"
          lang={locale}
          className="text-caption font-semibold text-ink-muted uppercase"
        >
          {t('qr.manual')}
        </label>
        <Input
          id="qr-manual"
          name="qrId"
          lang={locale}
          value={value}
          disabled={busy}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('qr.manual.placeholder')}
          className="tabular font-semibold"
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" size="field" disabled={busy || value.trim() === ''}>
          <Search aria-hidden="true" />
          <BiLabel k="common.continue" secondaryClassName="text-action-fg/75" />
        </Button>
      </form>
    </Plate>
  );
}
