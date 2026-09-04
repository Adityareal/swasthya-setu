'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import type { Patient } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { encodeQrDataUrl, qrPayload } from '@/lib/qr/encode';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';

/**
 * The printable patient card (Req 18.1).
 *
 * IT IS DESIGNED TO BE PRINTED, NOT SCREENSHOTTED. The demo scans a card off
 * paper, and paper is also what makes the feature useful at all: an ASHA cannot
 * scan a code that lives on the patient's phone, because the patient she is
 * looking for is the one who does not have the app.
 *
 * So the print rules live here, next to the thing they print, rather than in the
 * global stylesheet. `@media print` in `globals.css` would be a rule that has to
 * know about every screen's chrome; scoped to this component it only has to know
 * about this card. `.ss-print-hide` is opt-in and applied by hand to the two
 * controls on the page, and everything else — the app bar, the nav, the
 * connectivity banner — is hidden by one rule that keeps only the printable
 * subtree visible.
 *
 * The `qrId` is printed AS TEXT beneath the symbol. A creased card, a low-toner
 * print or a phone with no camera all end at the same place: someone reads four
 * groups of characters aloud and someone else types them into the manual field on
 * the scan screen. A code with no human-readable form is a code with one failure
 * mode and no recovery.
 */
export function QrCard({ patient }: { patient: Patient }) {
  const { t, locale } = useT();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const payload = qrPayload(patient.qrId);

  useEffect(() => {
    let live = true;
    setDataUrl(null);
    setFailed(false);
    void encodeQrDataUrl(payload)
      .then((url) => {
        if (live) setDataUrl(url);
      })
      .catch(() => {
        /* The symbol is a convenience; the printed id below it is the record.
           So a failed encode degrades to a card that is still usable by hand
           rather than to an error screen. */
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [payload]);

  const meta = [patient.village, patient.district].filter(Boolean).join(' · ');

  return (
    <>
      <style>{PRINT_CSS}</style>

      <Plate className="ss-print-area p-4" as="section">
        <h2>
          <BiLabel k="qr.title" className="text-title font-semibold text-ink" />
        </h2>

        {/* ——— The symbol. White field, ink border, centred: a scanner needs the
                quiet zone intact, so the plate's own fill does not run under it. ——— */}
        <div className="mt-3 flex justify-center">
          <div className="rounded-plate border-2 border-line bg-white p-3">
            {dataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- a
                 generated data URL has no remote origin for `next/image` to
                 optimise, and `output: 'export'` ships no image optimiser. */
              <img
                src={dataUrl}
                alt={`${t('qr.title')}: ${payload}`}
                width={220}
                height={220}
                className="block size-[220px]"
              />
            ) : failed ? (
              <div className="flex size-[220px] items-center justify-center">
                <p
                  lang={locale}
                  className="max-w-[24ch] text-center text-caption font-semibold text-ink-muted"
                >
                  {t('common.error')}
                </p>
              </div>
            ) : (
              <div className="skeleton-plate size-[220px]" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* ——— Who the card is for ——— */}
        <p
          lang={locale}
          className="mt-3 text-center text-headline leading-tight font-extrabold break-words text-ink"
        >
          {patient.fullName}
        </p>

        {meta && (
          <p
            lang={locale}
            className="mt-1 text-center text-caption font-semibold text-ink-muted"
          >
            {meta}
          </p>
        )}

        {/* ——— The id in the clear, and the reason the card survives a bad print ——— */}
        <div className="mt-3 border-t-2 border-line pt-3 text-center">
          <p className="text-caption font-semibold text-ink-muted uppercase">
            {t('qr.id')}
          </p>
          <p className="tabular mt-0.5 text-title font-extrabold break-all text-ink">
            {payload}
          </p>
        </div>
      </Plate>

      <Button
        type="button"
        variant="outline"
        size="field"
        className="ss-print-hide"
        onClick={() => window.print()}
      >
        <Printer aria-hidden="true" />
        <BiLabel k="qr.print" />
      </Button>
    </>
  );
}

/**
 * Print rules, scoped to this card.
 *
 * `visibility` rather than `display: none` on the ancestor chain, because the
 * card is nested inside the App_Shell's layout and collapsing the shell would
 * collapse the card with it. Hiding everything and then un-hiding the card's
 * subtree keeps the box model intact while removing every pixel of chrome.
 *
 * Colours are forced to plain black on white for the print sheet only. This is
 * the one place a hex value is the correct answer rather than a token: the sheet
 * is not the product's surface, it is a scanner target, and `--ss-ink` is a
 * near-black that a low-toner laser renders as grey.
 */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .ss-print-area, .ss-print-area * { visibility: visible !important; }
  .ss-print-hide { display: none !important; }
  .ss-print-area {
    position: absolute !important;
    inset-inline: 0 !important;
    top: 0 !important;
    margin: 0 auto !important;
    width: 74mm !important;
    box-shadow: none !important;
    border-color: #000 !important;
    background: #fff !important;
    color: #000 !important;
  }
  .ss-print-area * {
    color: #000 !important;
    border-color: #000 !important;
    box-shadow: none !important;
  }
  .ss-print-area img { image-rendering: pixelated; }
  @page { margin: 10mm; }
}
`;
