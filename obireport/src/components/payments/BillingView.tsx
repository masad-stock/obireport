import { useEffect, useState, type FormEvent } from 'react';
import { Info, Smartphone } from 'lucide-react';
import {
  fetchPaymentHistory,
  fetchPaymentPackages,
  initiateStkPayment,
} from '../../services/api';
import type { CreditPackage, PaymentRecord } from '../../types';
import { formatDateTime, formatKes } from '../../utils/formatters';

interface BillingViewProps {
  credits: number;
  simulinkpayConfigured: boolean;
  onRefreshProfile: () => Promise<void>;
  onNotify: (toast: { type: 'success' | 'error' | 'info'; title: string; description?: string }) => void;
}

export function BillingView({
  credits,
  simulinkpayConfigured,
  onRefreshProfile,
  onNotify,
}: BillingViewProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [gatewayReady, setGatewayReady] = useState(simulinkpayConfigured);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('scholar_pack');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const [pkgRes, histRes] = await Promise.all([
        fetchPaymentPackages(),
        fetchPaymentHistory(),
      ]);
      setPackages(pkgRes.packages);
      setGatewayReady(pkgRes.simulinkpayConfigured);
      setPayments(histRes.payments);
      if (pkgRes.packages.length > 0 && !pkgRes.packages.some((p) => p.id === selectedPkgId)) {
        setSelectedPkgId(pkgRes.packages[0].id);
      }
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'Failed to load billing details',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBilling();
  }, []);

  const selectedPackage = packages.find((p) => p.id === selectedPkgId);

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || submitting) return;

    setSubmitting(true);
    try {
      const result = await initiateStkPayment({
        packageId: selectedPackage.id,
        phoneNumber,
      });
      onNotify({
        type: 'success',
        title: 'M-Pesa STK Push Sent',
        description: result.message,
      });
      setPhoneNumber('');
      await Promise.all([loadBilling(), onRefreshProfile()]);
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'Payment initiation failed',
        description: err instanceof Error ? err.message : 'Unable to reach M-Pesa gateway.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderPaymentStatus = (status: PaymentRecord['status']) => {
    if (status === 'completed') {
      return <span className="font-medium text-emerald-700 dark:text-emerald-400">Completed</span>;
    }
    if (status === 'failed') {
      return <span className="font-medium text-red-700 dark:text-red-400">Failed</span>;
    }
    if (status === 'refunded') {
      return <span className="font-medium text-slate-600 dark:text-slate-400">Refunded</span>;
    }
    return <span className="font-medium text-amber-700 dark:text-amber-400">Pending</span>;
  };

  return (
    <div className="space-y-6">
      {/* Credit Balance Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Available Report Balance
          </p>
          <p className="mt-1 font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {credits} {credits === 1 ? 'Credit' : 'Credits'}
          </p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
          Each verification consumes 1 credit. Failed checks automatically refund your credit back
          to your balance.
        </p>
      </div>

      {!gatewayReady && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">M-Pesa Gateway Pending Configuration</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Live M-Pesa STK Push payments will activate once payment gateway credentials are
              connected in server settings.
            </p>
          </div>
        </div>
      )}

      {/* Package Selection + STK Push Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Select Credit Bundle
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {packages.map((pkg) => {
              const selected = pkg.id === selectedPkgId;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPkgId(pkg.id)}
                  className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                    selected
                      ? 'border-blue-700 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{pkg.audience}</p>
                      <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {pkg.name} · {pkg.credits} {pkg.credits === 1 ? 'Credit' : 'Credits'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                        KES {pkg.amountKes.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        KES {pkg.perCheckKes} / check
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Pay via M-Pesa
              </h2>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Enter your Safaricom M-Pesa number to receive an instant STK push prompt on your
              phone.
            </p>

            <form onSubmit={handleCheckout} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="mpesa-phone"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  M-Pesa Phone Number
                </label>
                <input
                  id="mpesa-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0712 345 678"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-base sm:text-sm text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {selectedPackage && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {selectedPackage.name} ({selectedPackage.credits} credits)
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    KES {selectedPackage.amountKes.toLocaleString()}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedPackage}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 active:scale-[0.99] cursor-pointer"
              >
                {submitting
                  ? 'Sending STK Push...'
                  : selectedPackage
                    ? `Send STK Push · KES ${selectedPackage.amountKes.toLocaleString()}`
                    : 'Select a package'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Transaction History
          </h2>
        </div>

        {/* Mobile Stacked Transactions */}
        <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
          {loading ? (
            <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading transactions...
            </div>
          ) : payments.length === 0 ? (
            <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No M-Pesa transactions recorded yet.
            </div>
          ) : (
            payments.map((tx) => (
              <div key={tx.id} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                    {tx.description || 'Credit purchase'}
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatKes(tx.amountCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">
                    {tx.phoneNumber || '—'} · +{tx.creditsPurchased} cr
                  </span>
                  {renderPaymentStatus(tx.status)}
                </div>
                <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {tx.simulinkpayReference || tx.id.slice(0, 8)} · {formatDateTime(tx.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-medium">Reference</th>
                <th className="py-3 px-4 font-medium">Description</th>
                <th className="py-3 px-4 font-medium">Phone</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Credits</th>
                <th className="py-3 px-4 font-medium text-right">Amount</th>
                <th className="py-3 px-4 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-500 dark:text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400">
                    No M-Pesa transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-slate-100">
                      {tx.simulinkpayReference || tx.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {tx.description || 'Credit purchase'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {tx.phoneNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs">{renderPaymentStatus(tx.status)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      +{tx.creditsPurchased}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                      {formatKes(tx.amountCents)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatDateTime(tx.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
