"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";

interface MortgageResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  loanAmount: number;
  downPayment: number;
}

interface RentAffordability {
  maxRent: number;
  recommendedRent: number;
  isAffordable: boolean;
}

export default function MortgageCalculator() {
  const [tab, setTab] = useState<"mortgage" | "rent" | "nhf">("mortgage");

  // Mortgage
  const [propPrice, setPropPrice] = useState("");
  const [downPercent, setDownPercent] = useState("20");
  const [rate, setRate] = useState("22"); // Current Nigeria mortgage rate ~22%
  const [years, setYears] = useState("15");
  const [mortgageResult, setMortgageResult] = useState<MortgageResult | null>(null);

  // Rent affordability
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [rentAffordability, setRentAffordability] = useState<RentAffordability | null>(null);

  // NHF
  const [nhfSalary, setNhfSalary] = useState("");
  const [nhfYears, setNhfYears] = useState("25");

  const calculateMortgage = () => {
    const price = Number(propPrice);
    const down = (Number(downPercent) / 100) * price;
    const loan = price - down;
    const monthlyRate = Number(rate) / 100 / 12;
    const n = Number(years) * 12;

    if (!price || !loan || !monthlyRate || !n) return;

    const monthly = (loan * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    const total = monthly * n;

    setMortgageResult({
      monthlyPayment: Math.round(monthly),
      totalPayment: Math.round(total),
      totalInterest: Math.round(total - loan),
      loanAmount: Math.round(loan),
      downPayment: Math.round(down),
    });
  };

  const calculateRentAffordability = () => {
    const income = Number(monthlyIncome);
    if (!income) return;
    // Rule: rent should be 30% of income max
    const maxRent = Math.round(income * 0.3);
    const recommended = Math.round(income * 0.25);
    setRentAffordability({
      maxRent,
      recommendedRent: recommended,
      isAffordable: true,
    });
  };

  // NHF calculation (simplified)
  const nhfMonthlyContribution = Math.round(Number(nhfSalary) * 0.025);
  const nhfMaxLoan = nhfMonthlyContribution * 12 * Number(nhfYears) * 2.5;
  const nhfRate = 6; // NHF rate is 6%
  const nhfMonthlyRate = nhfRate / 100 / 12;
  const nhfN = Number(nhfYears) * 12;
  const nhfMonthlyPayment = nhfMaxLoan > 0
    ? Math.round((nhfMaxLoan * nhfMonthlyRate * Math.pow(1 + nhfMonthlyRate, nhfN)) / (Math.pow(1 + nhfMonthlyRate, nhfN) - 1))
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-serif font-bold text-foreground">Property Calculator</h2>
          <p className="text-sm text-muted-foreground">Mortgage, rent affordability & NHF estimator</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6">
        {[
          { id: "mortgage", label: "Mortgage" },
          { id: "rent",     label: "Rent Affordability" },
          { id: "nhf",      label: "NHF Loan" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              tab === t.id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Mortgage Calculator */}
      {tab === "mortgage" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Property Price (₦)</Label>
              <Input type="number" className="mt-1" value={propPrice}
                onChange={(e) => setPropPrice(e.target.value)}
                placeholder="e.g. 30000000" />
            </div>
            <div>
              <Label>Down Payment (%)</Label>
              <Input type="number" className="mt-1" value={downPercent}
                onChange={(e) => setDownPercent(e.target.value)} min={5} max={100} />
              {propPrice && <p className="text-xs text-muted-foreground mt-1">
                = {formatCurrency((Number(downPercent) / 100) * Number(propPrice))}
              </p>}
            </div>
            <div>
              <Label>Interest Rate (% p.a.)</Label>
              <Input type="number" className="mt-1" value={rate}
                onChange={(e) => setRate(e.target.value)} min={1} max={50} />
            </div>
            <div className="col-span-2">
              <Label>Loan Duration</Label>
              <div className="flex gap-2 mt-1">
                {[5, 10, 15, 20, 25].map((y) => (
                  <button key={y} onClick={() => setYears(String(y))}
                    className={cn("flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                      years === String(y) ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:border-primary/40"
                    )}>
                    {y}yr
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={calculateMortgage}>Calculate</Button>

          {mortgageResult && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Monthly Payment</p>
                <p className="text-3xl font-serif font-bold text-primary">{formatCurrency(mortgageResult.monthlyPayment)}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-primary/20">
                {[
                  { label: "Down Payment", value: formatCurrency(mortgageResult.downPayment) },
                  { label: "Loan Amount", value: formatCurrency(mortgageResult.loanAmount) },
                  { label: "Total Interest", value: formatCurrency(mortgageResult.totalInterest) },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <Info className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  Based on {rate}% interest rate. Actual rates vary by bank.
                  Current Nigerian mortgage rates range from 18–28% p.a.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rent Affordability */}
      {tab === "rent" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <Label>Monthly Take-Home Income (₦)</Label>
            <Input type="number" className="mt-1" value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              placeholder="e.g. 500000" />
            <p className="text-xs text-muted-foreground mt-1">Enter your net monthly income after tax</p>
          </div>

          <Button className="w-full" onClick={calculateRentAffordability}>Calculate Affordability</Button>

          {rentAffordability && (
            <div className="space-y-3">
              <div className={cn("rounded-xl p-4 text-center",
                rentAffordability.isAffordable ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
              )}>
                <p className="text-xs text-muted-foreground">Recommended Monthly Rent</p>
                <p className="text-3xl font-serif font-bold text-green-600">{formatCurrency(rentAffordability.recommendedRent)}</p>
                <p className="text-xs text-muted-foreground mt-1">25% of your income</p>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-foreground">Maximum rent (30% rule)</p>
                  <p className="font-bold text-foreground">{formatCurrency(rentAffordability.maxRent)}</p>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-foreground">Recommended (25% rule)</p>
                  <p className="font-bold text-green-600">{formatCurrency(rentAffordability.recommendedRent)}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  <strong>Nigerian context:</strong> Most landlords require 1–2 years rent upfront.
                  Budget {formatCurrency(rentAffordability.recommendedRent * 12)}–{formatCurrency(rentAffordability.recommendedRent * 24)} for initial payment.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NHF Calculator */}
      {tab === "nhf" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
            <p className="text-xs text-blue-800">
              <strong>National Housing Fund (NHF):</strong> Nigerian workers can borrow up to ₦15M
              at 6% p.a. through the Federal Mortgage Bank of Nigeria (FMBN).
              You must have contributed for at least 6 months.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Monthly Basic Salary (₦)</Label>
              <Input type="number" className="mt-1" value={nhfSalary}
                onChange={(e) => setNhfSalary(e.target.value)}
                placeholder="e.g. 200000" />
              <p className="text-xs text-muted-foreground mt-1">
                You contribute 2.5% = {nhfSalary ? formatCurrency(nhfMonthlyContribution) : "—"}/month
              </p>
            </div>
            <div className="col-span-2">
              <Label>Loan Repayment Period</Label>
              <div className="flex gap-2 mt-1">
                {[10, 15, 20, 25, 30].map((y) => (
                  <button key={y} onClick={() => setNhfYears(String(y))}
                    className={cn("flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                      nhfYears === String(y) ? "bg-primary text-primary-foreground border-primary" : "border-border"
                    )}>
                    {y}yr
                  </button>
                ))}
              </div>
            </div>
          </div>

          {nhfSalary && Number(nhfSalary) > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Estimated Max NHF Loan</p>
                <p className="text-3xl font-serif font-bold text-primary">{formatCurrency(Math.min(nhfMaxLoan, 15000000))}</p>
                <p className="text-xs text-muted-foreground mt-1">Capped at ₦15,000,000 by FMBN</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-primary/20">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Monthly Contribution</p>
                  <p className="font-bold text-foreground">{formatCurrency(nhfMonthlyContribution)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Monthly Repayment (6%)</p>
                  <p className="font-bold text-foreground">{formatCurrency(nhfMonthlyPayment)}</p>
                </div>
              </div>
              <a href="https://www.fmbn.gov.ng" target="_blank" rel="noopener noreferrer"
                className="block text-center text-xs text-primary underline">
                Learn more at FMBN website →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
