import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Store,
  Clock,
  ShoppingBag,
  ArrowRight,
  QrCode,
  TrendingDown,
  CheckCircle2,
  Zap,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

/**
 * HowItWorksSection
 *
 * Interactive, motion-enhanced 3-step pipeline matching NearExpiry's dashboard UI.
 * Features:
 * - Dashboard-style KPI widgets and batch status simulation inside each step
 * - Smooth hover lift, interactive card selection, and connecting flow markers
 * - Prominent "Learn More About Us" button linking to the dedicated /about page
 */
export const HowItWorksSection = () => {
  const [activeStep, setActiveStep] = useState(1);

  const steps = [
    {
      id: 1,
      stepNumber: '1',
      title: 'Stores Register Batches',
      subtitle: 'Step 01 · Batch Registration',
      description:
        'Supermarkets register stock with exact manufacturing & expiry dates. Every batch receives a unique cryptographic QR token.',
      badgeStyle: 'bg-brand-100 text-brand-700 border-brand-200',
      activeRing: 'border-brand-500 ring-4 ring-brand-50 shadow-lg',
      accentColor: 'text-brand-600',
      icon: Store,
      metricLabel: 'Batch Protocol',
      metricValue: '100% FEFO Automated',
      pill: 'QR Token Generated',
      pillIcon: QrCode,
      details: [
        'Strict batch & expiry date logging',
        'Cryptographic token generation',
        'Inventory synced directly to local radar',
      ],
    },
    {
      id: 2,
      stepNumber: '2',
      title: 'Dynamic Algorithm Discounts',
      subtitle: 'Step 02 · Dynamic Pricing Radar',
      description:
        'As expiry dates draw nearer, prices drop automatically (10% → 25% → 40% → 60% → 75%). Safe food never goes to waste.',
      badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
      activeRing: 'border-amber-400 ring-4 ring-amber-50 shadow-lg',
      accentColor: 'text-amber-600',
      icon: TrendingDown,
      metricLabel: 'Price Drop Curve',
      metricValue: 'Up to 75% OFF',
      pill: '24h Recalculation Engine',
      pillIcon: Clock,
      details: [
        'Automated price drops every 24 hours',
        'Fair pricing guarantees zero grocery waste',
        'Transparent discount tags for buyers',
      ],
    },
    {
      id: 3,
      stepNumber: '3',
      title: 'Pickup or Local Delivery',
      subtitle: 'Step 03 · Local Fulfillment',
      description:
        'Shoppers order directly, saving hundreds of rupees. Stores mark orders ready and avoid write-off inventory losses.',
      badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200',
      activeRing: 'border-blue-500 ring-4 ring-blue-50 shadow-lg',
      accentColor: 'text-blue-600',
      icon: ShoppingBag,
      metricLabel: 'Customer Benefit',
      metricValue: 'Max Savings & Zero Waste',
      pill: 'Single-Scan QR Pickup',
      pillIcon: ShieldCheck,
      details: [
        'Single-scan contactless store pickup',
        'Rapid local order fulfillment',
        'Stores recover working capital & stop losses',
      ],
    },
  ];

  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-20 border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-bold text-brand-700 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            Automated Rescue Protocol
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            How NearExpiry Works
          </h2>

          <p className="text-base sm:text-lg text-gray-600 leading-relaxed font-normal">
            Our automated First-Expired-First-Out (FEFO) engine recalculates dynamic pricing every 24 hours to guarantee zero food waste and maximum grocery savings.
          </p>

          {/* Flow Stepper Bar (Interactive) */}
          <div className="inline-flex items-center gap-2 p-1.5 bg-gray-100 rounded-full border border-gray-200 mt-4 shadow-inner">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  activeStep === s.id
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200 scale-105'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-[10px]">
                  {s.stepNumber}
                </span>
                Step {s.stepNumber}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative items-stretch">
          {steps.map((step) => {
            const Icon = step.icon;
            const PillIcon = step.pillIcon;
            const isActive = activeStep === step.id;

            return (
              <div
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`group relative rounded-3xl p-7 transition-all duration-300 flex flex-col justify-between cursor-pointer border-2 bg-white ${
                  isActive
                    ? `${step.activeRing}`
                    : 'border-gray-200/90 hover:border-gray-300 hover:shadow-xl hover:-translate-y-2'
                }`}
              >
                <div>
                  {/* Top Header: Step Number Badge + Live Status Pill */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${step.badgeStyle}`}
                    >
                      {step.stepNumber}
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-[11px] font-semibold text-gray-600">
                      <PillIcon className="w-3.5 h-3.5 text-gray-500" />
                      <span>{step.pill}</span>
                    </div>
                  </div>

                  {/* Step Titles */}
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    {step.subtitle}
                  </div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight leading-snug mb-3 group-hover:text-brand-700 transition">
                    {step.title}
                  </h3>

                  <p className="text-sm text-gray-600 leading-relaxed mb-6 font-normal">
                    {step.description}
                  </p>
                </div>

                <div>
                  {/* Dashboard-Style Simulation Widget */}
                  <div className="bg-gray-50/90 rounded-2xl p-4 border border-gray-200/80 mb-5 space-y-2.5 group-hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">{step.metricLabel}</span>
                      <span className={`font-bold ${step.accentColor}`}>{step.metricValue}</span>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          step.id === 1
                            ? 'w-1/3 bg-brand-500'
                            : step.id === 2
                            ? 'w-2/3 bg-amber-500'
                            : 'w-full bg-blue-500'
                        }`}
                      />
                    </div>

                    {/* Key Bullets */}
                    <div className="pt-1.5 space-y-1.5">
                      {step.details.map((detail, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px] text-gray-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Step Indicator Pill */}
                  <div
                    className={`text-xs font-bold flex items-center justify-between pt-2 border-t border-gray-100 ${
                      isActive ? step.accentColor : 'text-gray-400'
                    }`}
                  >
                    <span>{isActive ? '● Active Step Selected' : 'Click to highlight step'}</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isActive ? 'translate-x-1' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* =========================================================
            "Learn More About Us" Action Ribbon & Navigation
            ========================================================= */}
        <div className="mt-14 pt-10 border-t border-gray-200">
          <div className="rounded-3xl bg-gradient-to-r from-gray-50 via-white to-gray-50 border border-gray-200 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Want to know our full story?
              </div>
              <h4 className="text-xl font-black text-gray-900">
                Discover How NearExpiry is Transforming Urban Retail
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 max-w-xl">
                Read about our journey, verified supermarket network, FEFO dynamic algorithm, and mission to eliminate food waste in every neighborhood.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
              <Link
                to="/about"
                className="px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 group"
              >
                Learn More About Us
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/marketplace"
                className="px-5 py-3.5 bg-white hover:bg-gray-100 text-gray-800 font-bold text-sm rounded-xl border border-gray-300 transition shadow-sm flex items-center gap-1.5"
              >
                <ShoppingBag className="w-4 h-4 text-gray-500" />
                Explore Deals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
