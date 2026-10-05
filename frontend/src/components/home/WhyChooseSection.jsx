import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  ShoppingBag,
  Globe,
  Sparkles,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

/**
 * WhyChooseSection
 *
 * Light, clean, brand-matching section for NearExpiry:
 * - Pure white card container with subtle gray border (bg-white border-gray-200)
 * - Brand green (#16a34a) and warm amber highlights
 * - High-contrast typography (text-gray-900, text-gray-600)
 * - Seamless integration with "How NearExpiry Works" and marketplace UI
 */
export const WhyChooseSection = () => {
  // Track active expanded card: 'sellers' | 'buyers' | 'everyone' | null
  const [activeCard, setActiveCard] = useState('sellers');

  const handleCardToggle = (id) => {
    setActiveCard((prev) => (prev === id ? null : id));
  };

  const handleScrollToHowItWorks = (e) => {
    e.preventDefault();
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const pillars = [
    {
      id: 'sellers',
      badge: 'FOR SELLERS',
      badgeClass: 'text-brand-700 bg-brand-50 border-brand-200',
      icon: Store,
      iconContainer: 'bg-brand-50 border-brand-200 text-brand-700',
      activeCardStyle: 'border-brand-500 ring-4 ring-brand-50 shadow-md',
      checkColor: 'text-brand-600',
      title: 'Monetize & Eliminate Loss',
      tagline: 'Turn products approaching expiry into immediate revenue instead of waste.',
      ctaText: 'Become a Seller',
      ctaTo: '/register-seller',
      ctaType: 'link',
      ctaBtnStyle: 'bg-brand-600 hover:bg-brand-700 text-white font-bold',
      benefits: [
        {
          title: 'Monetize Near-Expiry Inventory',
          desc: 'Turn products approaching expiry into revenue instead of waste.',
        },
        {
          title: 'Easy Product & Batch Management',
          desc: 'Manage products, batches, stock, pricing and expiry information.',
        },
        {
          title: 'Smart Pricing',
          desc: 'Dynamic discounts help move inventory before expiry.',
        },
        {
          title: 'Inventory & Expiry Visibility',
          desc: 'Track stock and identify products approaching expiry.',
        },
        {
          title: 'Order Management',
          desc: 'Manage customer orders through the seller portal.',
        },
      ],
    },
    {
      id: 'buyers',
      badge: 'FOR BUYERS',
      badgeClass: 'text-amber-800 bg-amber-50 border-amber-200',
      icon: ShoppingBag,
      iconContainer: 'bg-amber-50 border-amber-200 text-amber-700',
      activeCardStyle: 'border-amber-400 ring-4 ring-amber-50 shadow-md',
      checkColor: 'text-amber-600',
      title: 'Save Big on Fresh Goods',
      tagline: 'Find top-tier groceries and household essentials at up to 75% off.',
      ctaText: 'Explore Deals',
      ctaTo: '/marketplace',
      ctaType: 'link',
      ctaBtnStyle: 'bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold',
      benefits: [
        {
          title: 'Discover Discounted Products',
          desc: 'Find quality products available at reduced prices.',
        },
        {
          title: 'Transparent Pricing',
          desc: 'See current prices and applicable discounts clearly.',
        },
        {
          title: 'Expiry Awareness',
          desc: 'Clearly understand product expiry information before purchasing.',
        },
        {
          title: 'Nearby Deals',
          desc: 'Discover relevant products/stores based on marketplace availability.',
        },
        {
          title: 'Secure Checkout',
          desc: 'Add products to cart and complete purchases through the existing checkout flow.',
        },
      ],
    },
    {
      id: 'everyone',
      badge: 'FOR EVERYONE',
      badgeClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      icon: Globe,
      iconContainer: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      activeCardStyle: 'border-emerald-500 ring-4 ring-emerald-50 shadow-md',
      checkColor: 'text-emerald-600',
      title: 'Sustainable Circular Economy',
      tagline: 'Keep useful goods circulating longer and eliminate unnecessary waste.',
      ctaText: 'Learn How It Works',
      ctaTo: '#how-it-works',
      ctaType: 'anchor',
      ctaBtnStyle: 'bg-gray-900 hover:bg-gray-800 text-white font-bold',
      benefits: [
        {
          title: 'Reduce Food & Product Waste',
          desc: 'Help prevent usable products from becoming waste.',
        },
        {
          title: 'Save Money',
          desc: 'Buyers get better prices while sellers recover value from inventory.',
        },
        {
          title: 'Support a Circular Economy',
          desc: 'Keep useful products in circulation for longer.',
        },
        {
          title: 'Transparent Marketplace',
          desc: 'Clear product, price, stock and expiry information.',
        },
        {
          title: 'Sustainable Shopping',
          desc: 'Make smarter purchases while helping reduce unnecessary waste.',
        },
      ],
    },
  ];

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-10"
      aria-label="Why Choose NearExpiry"
    >
      {/* Light Clean Card Container matching NearExpiry's Landing Page */}
      <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-6 sm:p-10 md:p-14">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-bold text-brand-700 uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            The NearExpiry Advantage
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            Why Choose NearExpiry?
          </h2>

          <p className="text-base sm:text-lg text-gray-600 font-medium mt-3 leading-relaxed">
            Built for Sellers. Better for Buyers. Smarter for Everyone.
          </p>

          <p className="text-xs sm:text-sm text-gray-400 mt-1.5">
            Click any card to expand full benefits & ecosystem capabilities
          </p>
        </div>

        {/* 3 Interactive Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const isExpanded = activeCard === pillar.id;

            return (
              <div key={pillar.id} className="transition-all duration-300">
                <div
                  onClick={() => handleCardToggle(pillar.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardToggle(pillar.id);
                    }
                  }}
                  className={`rounded-2xl p-6 sm:p-7 text-left cursor-pointer transition-all duration-300 select-none border-2 bg-white ${
                    isExpanded
                      ? `${pillar.activeCardStyle}`
                      : 'border-gray-200/90 hover:border-gray-300 hover:shadow-md hover:-translate-y-1'
                  }`}
                >
                  {/* Card Header: Badge + Details indicator */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border ${pillar.badgeClass}`}
                    >
                      {pillar.badge}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 transition">
                      <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-brand-600' : 'text-gray-400'
                        }`}
                      />
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm ${pillar.iconContainer}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 tracking-tight leading-snug">
                        {pillar.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
                        {pillar.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 my-4" />

                  {/* Benefits List (Expandable) */}
                  <div className="space-y-3">
                    {pillar.benefits.map((benefit, bIdx) => {
                      const isExtra = bIdx >= 2;
                      if (isExtra && !isExpanded) return null;

                      return (
                        <div
                          key={benefit.title}
                          className="flex items-start gap-3 transition-opacity duration-200"
                        >
                          <CheckCircle2
                            className={`w-4 h-4 flex-shrink-0 mt-0.5 ${pillar.checkColor}`}
                          />
                          <div>
                            <div className="text-sm font-semibold text-gray-900 leading-tight">
                              {benefit.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                              {benefit.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Preview label when collapsed */}
                  {!isExpanded && (
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                      <span>+3 more capabilities</span>
                      <span className="flex items-center gap-1 font-semibold text-brand-600">
                        Tap to expand <ChevronDown className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}

                  {/* Expanded CTA Action */}
                  {isExpanded && (
                    <div
                      className="mt-6 pt-5 border-t border-gray-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pillar.ctaType === 'link' ? (
                        <Link
                          to={pillar.ctaTo}
                          className={`w-full py-3 px-5 rounded-xl transition shadow-sm hover:shadow flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
                        >
                          {pillar.ctaText}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <a
                          href={pillar.ctaTo}
                          onClick={handleScrollToHowItWorks}
                          className={`w-full py-3 px-5 rounded-xl transition shadow-sm hover:shadow flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
                        >
                          {pillar.ctaText}
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseSection;
