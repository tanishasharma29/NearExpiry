import React, { useState, useEffect, useRef } from 'react';
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
 * WhyChooseNearExpiry
 *
 * Matching pixel-for-pixel with reference UI:
 * - Clean white background (no dark outer shell)
 * - Centered "THE NEAREXPIRY ADVANTAGE" pill badge
 * - Bold "Why Choose NearExpiry?" header
 * - 3 distinct interactive pillar cards:
 *   - Card 1: For Sellers (Emerald Green #22C55E theme)
 *   - Card 2: For Buyers (Amber #F59E0B theme)
 *   - Card 3: For Everyone (Blue #3B82F6 theme - expanded with Collapse)
 */
export const WhyChooseNearExpiry = () => {
  // Default to 'everyone' to match reference UI screenshot
  const [activeCard, setActiveCard] = useState('everyone');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

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
      badgeStyle: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: Store,
      iconBoxStyle: 'bg-emerald-50 text-emerald-600',
      activeBorder: 'border-2 border-emerald-400 shadow-md',
      inactiveBorder: 'border border-gray-200/90 shadow-sm hover:border-emerald-300 hover:shadow-md',
      title: 'Monetize & Eliminate Loss',
      tagline: 'Turn products approaching expiry into immediate revenue instead of waste.',
      ctaText: 'Become a Seller',
      ctaTo: '/register-seller',
      ctaType: 'link',
      ctaBtnStyle: 'bg-[#22C55E] hover:bg-[#16a34a] text-white font-bold',
      checkColor: 'text-emerald-500',
      accentColor: 'text-emerald-600',
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
      badgeStyle: 'text-amber-800 bg-amber-50 border-amber-200',
      icon: ShoppingBag,
      iconBoxStyle: 'bg-amber-50 text-amber-600',
      activeBorder: 'border-2 border-amber-400 shadow-md',
      inactiveBorder: 'border border-gray-200/90 shadow-sm hover:border-amber-300 hover:shadow-md',
      title: 'Save Big on Fresh Goods',
      tagline: 'Find top-tier groceries and household essentials at up to 75% off.',
      ctaText: 'Explore Deals',
      ctaTo: '/marketplace',
      ctaType: 'link',
      ctaBtnStyle: 'bg-amber-500 hover:bg-amber-600 text-white font-bold',
      checkColor: 'text-amber-500',
      accentColor: 'text-amber-600',
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
      badgeStyle: 'text-blue-800 bg-blue-50 border-blue-200',
      icon: Globe,
      iconBoxStyle: 'bg-blue-50 text-blue-600',
      activeBorder: 'border-2 border-blue-400 shadow-md',
      inactiveBorder: 'border border-gray-200/90 shadow-sm hover:border-blue-300 hover:shadow-md',
      title: 'Sustainable Circular Economy',
      tagline: 'Keep useful goods circulating longer and eliminate unnecessary waste.',
      ctaText: 'Learn How It Works',
      ctaTo: '#how-it-works',
      ctaType: 'anchor',
      ctaBtnStyle: 'bg-blue-600 hover:bg-blue-700 text-white font-bold',
      checkColor: 'text-blue-500',
      accentColor: 'text-blue-600',
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
      ref={sectionRef}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      aria-label="Why Choose NearExpiry"
    >
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          The NearExpiry Advantage
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
          Why Choose NearExpiry?
        </h2>

        <p className="text-base sm:text-lg text-gray-700 font-semibold mt-2 leading-relaxed">
          Built for Sellers. Better for Buyers. Smarter for Everyone.
        </p>

        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Click any card to expand full benefits & ecosystem capabilities
        </p>
      </div>

      {/* 3 Interactive Feature Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        {pillars.map((pillar, index) => {
          const Icon = pillar.icon;
          const isExpanded = activeCard === pillar.id;
          const isHovered = hoveredCard === pillar.id;
          const delayClass =
            index === 0
              ? 'delay-100'
              : index === 1
              ? 'delay-200'
              : 'delay-300';

          return (
            <div
              key={pillar.id}
              onMouseEnter={() => setHoveredCard(pillar.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`transition-all duration-500 ease-out ${delayClass} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              } ${hoveredCard && !isHovered ? 'lg:opacity-95' : 'opacity-100'}`}
            >
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
                className={`relative rounded-3xl p-6 sm:p-7 bg-white text-left cursor-pointer transition-all duration-300 transform select-none ${
                  isExpanded
                    ? `${pillar.activeBorder} -translate-y-1`
                    : `${pillar.inactiveBorder} hover:-translate-y-1`
                }`}
              >
                {/* Card Header: Badge + Details / Collapse Toggle */}
                <div className="flex items-center justify-between gap-2 mb-5">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${pillar.badgeStyle}`}
                  >
                    {pillar.badge}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 transition">
                    <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180 text-gray-700' : 'text-gray-400'
                      }`}
                    />
                  </span>
                </div>

                {/* Icon + Title */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${pillar.iconBoxStyle}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
                      {pillar.tagline}
                    </p>
                  </div>
                </div>

                {/* Benefits List */}
                <div className="space-y-3.5 mt-5">
                  {pillar.benefits.map((benefit, bIdx) => {
                    const isExtra = bIdx >= 2;
                    if (isExtra && !isExpanded) return null;

                    return (
                      <div
                        key={benefit.title}
                        className="flex items-start gap-3 transition-opacity duration-300"
                      >
                        <CheckCircle2
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${pillar.checkColor}`}
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

                {/* Expansion indicator preview for collapsed cards */}
                {!isExpanded && (
                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-medium">
                    <span>+3 more capabilities</span>
                    <span className={`flex items-center gap-1 font-semibold ${pillar.accentColor}`}>
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
                        className={`w-full py-3 px-5 rounded-xl transition shadow hover:shadow-md flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
                      >
                        {pillar.ctaText}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <a
                        href={pillar.ctaTo}
                        onClick={handleScrollToHowItWorks}
                        className={`w-full py-3 px-5 rounded-xl transition shadow hover:shadow-md flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
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
    </section>
  );
};

export default WhyChooseNearExpiry;

