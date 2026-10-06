import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Star,
  Quote,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

/**
 * CustomerReviewsAndFaq
 *
 * Placed below "How NearExpiry Works" on the Landing Page.
 * Features:
 * 1. 3 Customer Review cards visible at a time with click-to-elevate animation
 * 2. Seller Call-to-Action Banner ("Don't let stock expire in silence")
 * 3. Near Expiry Products FAQ Accordion
 */
export const CustomerReviewsAndFaq = () => {
  // Testimonials slide state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Active clicked review for slight elevation animation
  const [activeReviewId, setActiveReviewId] = useState(1);

  // FAQ Accordion state
  const [expandedFaq, setExpandedFaq] = useState(0);

  const testimonials = [
    {
      id: 1,
      name: 'Riya K.',
      location: 'Mumbai, India',
      rating: 5,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      review:
        'Amazing platform! I bought skincare and dairy at half the price. The products are 100% genuine, expiry dates are transparently logged, and the delivery was super fast. Highly recommended!',
    },
    {
      id: 2,
      name: 'Sameer J.',
      location: 'Delhi, India',
      rating: 5,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      review:
        "Easy to use and great deals every day. The dynamic expiry warnings and steep discounts are very helpful. I've saved thousands of rupees on monthly groceries already!",
    },
    {
      id: 3,
      name: 'Ananya P.',
      location: 'Bengaluru, India',
      rating: 5,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      review:
        'NearExpiry helps my family reduce grocery bills while stopping good food from ending up in landfills. The single-scan QR pickup at our neighborhood supermarket is so convenient!',
    },
    {
      id: 4,
      name: 'Vikram S.',
      location: 'Hyderabad, India',
      rating: 5,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      review:
        'Fantastic initiative! I run a local café and source bulk cereals and coffee lots through NearExpiry. Massive cost reduction and verified stock reliability every time.',
    },
    {
      id: 5,
      name: 'Priya M.',
      location: 'Pune, India',
      rating: 5,
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
      review:
        'Found premium artisanal chocolates and organic snacks at 60% off expiring in 2 weeks. The quality was flawless and packaging was completely intact.',
    },
    {
      id: 6,
      name: 'Rohan D.',
      location: 'Chennai, India',
      rating: 5,
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
      review:
        'The FEFO algorithm is brilliant. Getting notified when high-demand pantry staples enter steep discounts has changed how our household shops groceries.',
    },
  ];

  // Show 3 reviews at a time for desktop view
  const reviewsPerSlide = 3;
  const totalSlides = Math.ceil(testimonials.length / reviewsPerSlide);
  const currentTestimonials = testimonials.slice(
    currentSlide * reviewsPerSlide,
    currentSlide * reviewsPerSlide + reviewsPerSlide
  );

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleCardClick = (id) => {
    setActiveReviewId((prev) => (prev === id ? null : id));
  };

  const faqs = [
    {
      question: 'What are near expiry products?',
      answer:
        'Near expiry products are usable, safe, brand-authentic packaged goods, pantry items, and groceries approaching their manufacturer Best Before or Expiry date (typically 1 to 30 days remaining). Because retailers need to clear shelf space, they offer them through NearExpiry at steep dynamic discounts (up to 75% OFF) rather than letting safe food go to waste.',
    },
    {
      question: 'Are near expiry products the same as expired products?',
      answer:
        'No, absolutely not! NearExpiry strictly prohibits expired products. Every single item listed on our platform is 100% safe, legally compliant, and well within its manufacturer consumption window. Once a product reaches its official expiry timestamp, our automated FEFO radar immediately delists it from the public marketplace.',
    },
    {
      question: 'Who can sell on NearExpiry?',
      answer:
        'Verified supermarkets, grocery stores, bakeries, FMCG distributors, and food brand manufacturers can register on NearExpiry. Sellers gain an automated batch registration system, dynamic discount engine, and contactless QR pickup workflow to recover inventory working capital and stop food write-off losses.',
    },
    {
      question: 'How do I check remaining shelf life?',
      answer:
        'NearExpiry enforces total transparency. Every product card and details page prominently showcases the exact expiry date, remaining days countdown badge, dynamic discount percentage bracket, and verified supermarket lot number before you make any purchase.',
    },
    {
      question: 'How do store pickup and local deliveries work?',
      answer:
        'When you place an order, the neighborhood merchant packs your selected lots and assigns a unique cryptographic QR token. You can choose contactless store pickup (show your QR code for instant release) or prompt hyperlocal delivery straight to your doorstep.',
    },
  ];

  return (
    <div className="space-y-16 pt-16 mt-16 border-t border-gray-200">
      {/* =========================================================
          SECTION 1: TESTIMONIALS & CUSTOMER REVIEWS (3 CARDS PER ROW)
          ========================================================= */}
      <section className="text-center space-y-4">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-xs font-bold text-[#16a34a] uppercase tracking-wider shadow-sm">
          <MessageSquare className="w-3.5 h-3.5 text-[#22C55E]" />
          <span>Customer Reviews</span>
        </div>

        {/* Heading & Subtitle */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
          What Our <span className="text-[#16a34a]">Customers</span> Say
        </h2>

        <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Join thousands of happy customers who save money and reduce food waste with NearExpiry.
        </p>

        {/* 3 Review Cards Grid with Click-To-Elevate Motion */}
        <div className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch text-left">
            {currentTestimonials.map((t) => {
              const isElevated = activeReviewId === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => handleCardClick(t.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(t.id);
                    }
                  }}
                  className={`bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border transition-all duration-300 ease-out flex flex-col justify-between cursor-pointer select-none group ${
                    isElevated
                      ? '-translate-y-2.5 shadow-xl shadow-green-500/10 border-[#22C55E] ring-2 ring-[#22C55E]/25 scale-[1.01]'
                      : 'border-gray-200/90 shadow-sm hover:border-[#22C55E]/50 hover:shadow-md hover:-translate-y-1.5'
                  }`}
                >
                  <div>
                    {/* Reviewer Info (Avatar, Name, Location) BEFORE Review */}
                    <div className="flex items-center justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={t.avatar}
                          alt={t.name}
                          className={`w-11 h-11 min-w-[44px] min-h-[44px] max-w-[44px] max-h-[44px] rounded-full object-cover flex-shrink-0 border-2 transition-all duration-300 shadow-sm ${
                            isElevated
                              ? 'border-[#22C55E] ring-2 ring-[#22C55E]/30'
                              : 'border-emerald-100 group-hover:border-[#22C55E]/50'
                          }`}
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">
                            {t.name}
                          </h4>
                          <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-[#22C55E] flex-shrink-0" />
                            <span className="truncate">{t.location}</span>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          isElevated
                            ? 'bg-[#22C55E]/15 text-[#16a34a]'
                            : 'bg-gray-50 text-gray-300 group-hover:text-[#22C55E]/50'
                        }`}
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center gap-1 mb-2.5">
                      {[...Array(t.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>

                    {/* Review Text */}
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed italic">
                      "{t.review}"
                    </p>
                  </div>

                  {/* Active Card Indicator Hint */}
                  <div className="pt-3 mt-4 border-t border-gray-100 flex items-center justify-between text-[11px]">
                    <span
                      className={`font-semibold transition-colors ${
                        isElevated ? 'text-[#16a34a]' : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    >
                      {isElevated ? '● Highlighted' : 'Click to highlight'}
                    </span>
                    <span
                      className={`font-bold transition-all ${
                        isElevated ? 'text-[#16a34a]' : 'text-gray-300'
                      }`}
                    >
                      Verified Buyer
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Carousel Navigation Buttons & Pagination Dots */}
          <div className="flex flex-col items-center gap-3 pt-8">
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                aria-label="Previous testimonials"
                className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition flex items-center justify-center text-gray-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={nextSlide}
                aria-label="Next testimonials"
                className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition flex items-center justify-center text-gray-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Indicator Dots */}
            <div className="flex items-center gap-2">
              {[...Array(totalSlides)].map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    currentSlide === idx ? 'w-6 bg-[#22C55E]' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 2: SELLER CALL-TO-ACTION BANNER
          ========================================================= */}
      <section>
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-[11px] font-bold text-amber-400 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>SELL NEAR EXPIRY STOCK</span>
            </div>

            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
              Don't let stock expire in silence
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Manufacturers, supermarkets and distributors: list surplus or short dated inventory before value is lost.
            </p>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto">
            <Link
              to="/register-seller"
              className="w-full md:w-auto px-6 py-3.5 bg-white hover:bg-gray-100 text-gray-900 font-extrabold text-sm rounded-2xl shadow transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
            >
              <span>Go to sell page</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 3: NEAR EXPIRY PRODUCTS FAQ
          ========================================================= */}
      <section className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 border border-gray-200 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            <HelpCircle className="w-4 h-4 text-[#22C55E]" />
            <span>Got Questions?</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Near expiry products — FAQ
          </h3>
        </div>

        {/* FAQ Accordion List */}
        <div className="divide-y divide-gray-100">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;

            return (
              <div key={idx} className="py-4 sm:py-5">
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold transition-transform duration-200 ${
                        isExpanded ? 'text-[#16a34a] rotate-90' : 'text-gray-400 group-hover:text-gray-900'
                      }`}
                    >
                      ▶
                    </span>
                    <span
                      className={`text-base sm:text-lg font-bold transition-colors ${
                        isExpanded ? 'text-[#16a34a]' : 'text-gray-900 group-hover:text-gray-700'
                      }`}
                    >
                      {faq.question}
                    </span>
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-[#16a34a]' : ''
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="mt-3 pl-6 pr-2 text-sm sm:text-base text-gray-600 leading-relaxed animate-fadeIn">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default CustomerReviewsAndFaq;

