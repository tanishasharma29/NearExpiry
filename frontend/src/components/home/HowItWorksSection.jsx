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
} from 'lucide-react';
import { CustomerReviewsAndFaq } from './CustomerReviewsAndFaq';

/**
 * HowItWorksSection
 *
 * Matching pixel-for-pixel with reference UI screenshot 2:
 * - Centered "AUTOMATED RESCUE PROTOCOL" badge with pulse dot
 * - "How NearExpiry Works" header and FEFO subtitle
 * - Interactive step switcher tabs (Step 1, Step 2, Step 3)
 * - 3 distinct cards with individual color themes:
 *   - Step 1: Emerald Green (#22C55E)
 *   - Step 2: Amber (#F59E0B)
 *   - Step 3: Blue (#3B82F6 - active in reference screenshot)
 * - Below section: "Learn More About Us" CTA linking to /about
 */
export const HowItWorksSection = () => {
  // Default to 3 to match the reference screenshot 2
  const [activeStep, setActiveStep] = useState(3);

  const steps = [
    {
      id: 1,
      stepNumber: '1',
      title: 'Stores Register Batches',
      subtitle: 'STEP 01 · BATCH REGISTRATION',
      description:
        'Supermarkets register stock with exact manufacturing & expiry dates. Every batch receives a unique cryptographic QR token.',
      icon: Store,
      pill: 'QR Token Generated',
      pillIcon: QrCode,
      metricLabel: 'Batch Protocol',
      metricValue: '100% FEFO Automated',
      progressWidth: '33%',
      // Step 1 Green Theme (#22C55E)
      colorTheme: 'emerald',
      activeCardStyle: 'border-2 border-[#22C55E] ring-4 ring-[#22C55E]/10 shadow-lg',
      inactiveCardStyle: 'border border-gray-200/90 shadow-sm hover:border-[#22C55E]/50 hover:shadow-md',
      badgeActive: 'bg-[#22C55E] text-white shadow-md',
      badgeInactive: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      pillActive: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      pillInactive: 'bg-gray-50 border-gray-200 text-gray-700',
      pillIconColor: 'text-emerald-600',
      tabActive: 'bg-[#22C55E] text-white shadow-md',
      tabBadgeActive: 'bg-white text-emerald-700',
      subtitleColor: 'text-emerald-600',
      metricBadge: 'text-emerald-700 bg-emerald-100/70 border border-emerald-200/50',
      progressBar: 'bg-[#22C55E]',
      checkColor: 'text-emerald-500',
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
      subtitle: 'STEP 02 · DYNAMIC PRICING RADAR',
      description:
        'As expiry dates draw nearer, prices drop automatically (10% → 25% → 40% → 60% → 75%). Safe food never goes to waste.',
      icon: TrendingDown,
      pill: '24h Recalculation Engine',
      pillIcon: Clock,
      metricLabel: 'Price Drop Curve',
      metricValue: 'Up to 75% OFF',
      progressWidth: '66%',
      // Step 2 Amber Theme (#F59E0B)
      colorTheme: 'amber',
      activeCardStyle: 'border-2 border-amber-400 ring-4 ring-amber-400/10 shadow-lg',
      inactiveCardStyle: 'border border-gray-200/90 shadow-sm hover:border-amber-300 hover:shadow-md',
      badgeActive: 'bg-amber-500 text-white shadow-md',
      badgeInactive: 'bg-amber-50 text-amber-800 border border-amber-100',
      pillActive: 'bg-amber-50 border-amber-200 text-amber-800',
      pillInactive: 'bg-gray-50 border-gray-200 text-gray-700',
      pillIconColor: 'text-amber-500',
      tabActive: 'bg-amber-500 text-white shadow-md',
      tabBadgeActive: 'bg-white text-amber-700',
      subtitleColor: 'text-amber-600',
      metricBadge: 'text-amber-800 bg-amber-100/70 border border-amber-200/50',
      progressBar: 'bg-amber-500',
      checkColor: 'text-amber-500',
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
      subtitle: 'STEP 03 · LOCAL FULFILLMENT',
      description:
        'Shoppers order directly, saving hundreds of rupees. Stores mark orders ready and avoid write-off inventory losses.',
      icon: ShoppingBag,
      pill: 'Single-Scan QR Pickup',
      pillIcon: ShieldCheck,
      metricLabel: 'Customer Benefit',
      metricValue: 'Max Savings & Zero Waste',
      progressWidth: '100%',
      // Step 3 Blue Theme (#3B82F6)
      colorTheme: 'blue',
      activeCardStyle: 'border-2 border-blue-400 ring-4 ring-blue-400/10 shadow-lg',
      inactiveCardStyle: 'border border-gray-200/90 shadow-sm hover:border-blue-300 hover:shadow-md',
      badgeActive: 'bg-blue-600 text-white shadow-md',
      badgeInactive: 'bg-blue-50 text-blue-700 border border-blue-100',
      pillActive: 'bg-blue-50/80 border-blue-200 text-blue-700',
      pillInactive: 'bg-gray-50 border-gray-200 text-gray-700',
      pillIconColor: 'text-blue-600',
      tabActive: 'bg-blue-600 text-white shadow-md',
      tabBadgeActive: 'bg-white text-blue-600',
      subtitleColor: 'text-blue-600',
      metricBadge: 'text-blue-700 bg-blue-100/70 border border-blue-200/50',
      progressBar: 'bg-blue-600',
      checkColor: 'text-blue-500',
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
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 uppercase tracking-wider shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            AUTOMATED RESCUE PROTOCOL
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            How NearExpiry Works
          </h2>

          <p className="text-base sm:text-lg text-gray-600 leading-relaxed font-normal">
            Our automated First-Expired-First-Out (FEFO) engine recalculates dynamic pricing every 24 hours to guarantee zero food waste and maximum grocery savings.
          </p>

          {/* Interactive Step Switcher Tabs */}
          <div className="inline-flex items-center gap-2 p-1.5 bg-gray-100/80 rounded-full border border-gray-200 mt-4 shadow-inner">
            {steps.map((s) => {
              const isTabActive = activeStep === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(s.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                    isTabActive
                      ? `${s.tabActive} scale-105`
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold transition-colors ${
                      isTabActive ? s.tabBadgeActive : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {s.stepNumber}
                  </span>
                  Step {s.stepNumber}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Step Cards Grid with Flow Line */}
        <div className="relative">
          {/* Subtle connecting workflow line across steps on desktop */}
          <div className="hidden md:block absolute top-16 left-[18%] right-[18%] h-0.5 bg-gradient-to-r from-emerald-200 via-amber-200 to-blue-200 pointer-events-none z-0" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 items-stretch">
            {steps.map((step) => {
              const PillIcon = step.pillIcon;
              const isActive = activeStep === step.id;

              return (
                <div
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`group relative rounded-3xl p-7 transition-all duration-300 flex flex-col justify-between cursor-pointer bg-white ${
                    isActive ? step.activeCardStyle : step.inactiveCardStyle
                  }`}
                >
                  <div>
                    {/* Top Step Badge + Live Pill */}
                    <div className="flex items-center justify-between gap-2 mb-6">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm transition-all duration-300 ${
                          isActive ? step.badgeActive : step.badgeInactive
                        }`}
                      >
                        {step.stepNumber}
                      </div>

                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          isActive ? step.pillActive : step.pillInactive
                        }`}
                      >
                        <PillIcon className={`w-3.5 h-3.5 ${step.pillIconColor}`} />
                        <span>{step.pill}</span>
                      </div>
                    </div>

                    {/* Step Subtitle */}
                    <div
                      className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${step.subtitleColor}`}
                    >
                      {step.subtitle}
                    </div>

                    {/* Step Title */}
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-snug mb-2">
                      {step.title}
                    </h3>

                    {/* Step Description */}
                    <p className="text-sm text-gray-600 leading-relaxed mb-6 font-normal">
                      {step.description}
                    </p>
                  </div>

                  <div>
                    {/* Dashboard-Style Simulation Widget */}
                    <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 mb-2 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-medium">{step.metricLabel}</span>
                        <span className={`font-bold px-2 py-0.5 rounded-md ${step.metricBadge}`}>
                          {step.metricValue}
                        </span>
                      </div>

                      {/* Progress Bar in Step Color */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${step.progressBar}`}
                          style={{ width: step.progressWidth }}
                        />
                      </div>

                      {/* Feature Checkpoints */}
                      <div className="pt-2 space-y-2">
                        {step.details.map((detail, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                            <CheckCircle2
                              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${step.checkColor}`}
                            />
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================
            "Want to Know Our Full Story?" Ribbon Card (Image 2)
            ========================================================= */}
        <div className="mt-14">
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-gray-200 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div className="space-y-1 text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>WANT TO KNOW OUR FULL STORY?</span>
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Discover How NearExpiry is Transforming Urban Retail
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 max-w-2xl leading-relaxed">
                Read about our journey, verified supermarket network, FEFO dynamic algorithm, and mission to eliminate food waste in every neighborhood.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 flex-shrink-0 w-full md:w-auto">
              <Link
                to="/about"
                className="px-6 py-3.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm rounded-xl shadow-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 group"
              >
                <span>Learn More About Us</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/marketplace"
                className="px-5 py-3.5 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm rounded-xl border border-gray-300 transition shadow-sm flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4 text-gray-400" />
                <span>Explore Deals</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Customer Reviews, Seller CTA Banner & FAQ Accordion Section */}
        <CustomerReviewsAndFaq />
      </div>
    </section>
  );
};

export default HowItWorksSection;

