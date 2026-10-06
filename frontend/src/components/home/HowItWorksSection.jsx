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
  ShieldCheck,
  Zap,
  ChevronRight,
  Layers,
} from 'lucide-react';

/**
 * HowItWorksSection
 *
 * Dashboard-aligned 3-step pipeline matching NearExpiry's #22C55E theme:
 * - Animated interactive steps with connecting progress line
 * - Dashboard KPI simulation cards in each step
 * - Prominent "Learn More About Us" button below the section linking to /about
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
      icon: Store,
      metricLabel: 'Batch Protocol',
      metricValue: '100% FEFO Automated',
      pill: 'QR Token Generated',
      pillIcon: QrCode,
      progress: '33%',
      details: [
        'Strict batch & expiry date logging',
        'Cryptographic token generation',
        'Stock synced directly to hyperlocal radar',
      ],
    },
    {
      id: 2,
      stepNumber: '2',
      title: 'Dynamic Algorithm Discounts',
      subtitle: 'Step 02 · Dynamic Pricing Radar',
      description:
        'As expiry dates draw nearer, prices drop automatically (10% → 25% → 40% → 60% → 75%). Safe food never goes to waste.',
      icon: TrendingDown,
      metricLabel: 'Price Drop Curve',
      metricValue: 'Up to 75% OFF',
      pill: '24h Recalculation Engine',
      pillIcon: Clock,
      progress: '66%',
      details: [
        'Automated price drops every 24 hours',
        'Fair pricing guarantees zero grocery waste',
        'Transparent discount badges for shoppers',
      ],
    },
    {
      id: 3,
      stepNumber: '3',
      title: 'Pickup or Local Delivery',
      subtitle: 'Step 03 · Local Fulfillment',
      description:
        'Shoppers order directly, saving hundreds of rupees. Stores mark orders ready and avoid write-off inventory losses.',
      icon: ShoppingBag,
      metricLabel: 'Customer Benefit',
      metricValue: 'Max Savings & Zero Waste',
      pill: 'Single-Scan QR Pickup',
      pillIcon: ShieldCheck,
      progress: '100%',
      details: [
        'Single-scan contactless store pickup',
        'Rapid local order fulfillment within 5-10km',
        'Stores recover working capital & prevent losses',
      ],
    },
  ];

  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-24 border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-xs font-bold text-[#16a34a] uppercase tracking-wider shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
            </span>
            <Sparkles className="w-3.5 h-3.5 text-[#22C55E]" />
            Automated Rescue Protocol
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            How NearExpiry Works
          </h2>

          <p className="text-base sm:text-lg text-gray-600 leading-relaxed font-normal">
            Our automated First-Expired-First-Out (FEFO) engine recalculates dynamic pricing every 24 hours to guarantee zero food waste and maximum grocery savings.
          </p>

          {/* Interactive Step Switcher Tabs */}
          <div className="inline-flex items-center gap-2 p-1.5 bg-gray-100 rounded-full border border-gray-200 mt-4 shadow-inner">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                  activeStep === s.id
                    ? 'bg-white text-gray-900 shadow-md border border-[#22C55E]/40 scale-105'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold transition-colors ${
                    activeStep === s.id
                      ? 'bg-[#22C55E] text-white shadow-sm'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
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
                className={`group relative rounded-3xl p-7 sm:p-8 transition-all duration-300 flex flex-col justify-between cursor-pointer border-2 bg-white ${
                  isActive
                    ? 'border-[#22C55E] ring-4 ring-[#22C55E]/15 shadow-xl shadow-green-500/10 -translate-y-1'
                    : 'border-gray-200/90 hover:border-[#22C55E]/50 hover:shadow-xl hover:-translate-y-2'
                }`}
              >
                <div>
                  {/* Top Step Badge + Live Pill */}
                  <div className="flex items-center justify-between gap-2 mb-6">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${
                        isActive
                          ? 'bg-[#22C55E] text-white shadow-green-500/30 shadow-md'
                          : 'bg-[#22C55E]/10 text-[#16a34a] border border-[#22C55E]/20'
                      }`}
                    >
                      {step.stepNumber}
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700">
                      <PillIcon className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span>{step.pill}</span>
                    </div>
                  </div>

                  {/* Step Titles */}
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#16a34a] mb-1">
                    {step.subtitle}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-snug mb-3 group-hover:text-[#16a34a] transition">
                    {step.title}
                  </h3>

                  <p className="text-sm text-gray-600 leading-relaxed mb-6 font-normal">
                    {step.description}
                  </p>
                </div>

                <div>
                  {/* Dashboard-Style Simulation Widget with #22C55E Theme */}
                  <div className="bg-gray-50/90 rounded-2xl p-4 sm:p-5 border border-gray-200/80 mb-5 space-y-3 group-hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">{step.metricLabel}</span>
                      <span className="font-extrabold text-[#16a34a] bg-[#22C55E]/10 px-2 py-0.5 rounded-md">
                        {step.metricValue}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#22C55E] transition-all duration-500"
                        style={{ width: step.progress }}
                      />
                    </div>

                    {/* Feature Checkpoints */}
                    <div className="pt-2 space-y-2">
                      {step.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step Selector Hint */}
                  <div
                    className={`text-xs font-bold flex items-center justify-between pt-3 border-t border-gray-100 transition-colors ${
                      isActive ? 'text-[#16a34a]' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    <span>{isActive ? '● Active Step Selected' : 'Click to highlight step'}</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isActive ? 'translate-x-1 text-[#22C55E]' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* =========================================================
            PROMINENT BUTTON BELOW THIS SECTION: "Learn More About Us"
            ========================================================= */}
        <div className="mt-16 pt-12 border-t border-gray-200 text-center space-y-4">
          <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto font-medium">
            Curious about our mission, automated dynamic algorithms, and the team driving hyperlocal zero-waste grocery rescue?
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/about"
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#22C55E] hover:bg-[#16a34a] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 active:scale-95 transition-all duration-200 group"
            >
              <span>Learn More About Us</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-200" />
            </Link>

            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-base rounded-2xl transition shadow-sm"
            >
              <ShoppingBag className="w-5 h-5 text-gray-500" />
              <span>Explore Marketplace Deals</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
