import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Leaf,
  ShieldCheck,
  TrendingDown,
  Store,
  ShoppingBag,
  ArrowRight,
  QrCode,
  Users,
  Award,
  CheckCircle2,
  Clock,
  Heart,
  Globe,
} from 'lucide-react';

/**
 * AboutUsPage
 *
 * Dedicated page telling the NearExpiry story, mission, technology, and impact.
 * Accessible via /about and /about-us.
 */
export const AboutUsPage = () => {
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950 text-white p-8 sm:p-12 md:p-16 lg:p-20 overflow-hidden shadow-2xl">
          {/* Subtle Ambient Background Accents */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-emerald-300 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Our Mission & Vision
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-tight">
              Eat Fresh. <br />
              <span className="text-amber-300">Save Big.</span> <br />
              Waste Nothing.
            </h1>

            <p className="text-base sm:text-lg text-slate-200/90 leading-relaxed font-normal">
              NearExpiry is a dynamic hyperlocal grocery rescue platform designed to bridge the gap between neighborhood supermarkets and conscious consumers. We transform surplus, approaching-expiry stock into instant community savings and zero waste.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                to="/marketplace"
                className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-2"
              >
                Explore Today's Deals
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register-seller"
                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                Partner With Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Numbers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="text-3xl sm:text-4xl font-black text-brand-600">₹1.5M+</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1.5">
              Shopper Savings
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600">50,000+ kg</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1.5">
              Food Rescued
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="text-3xl sm:text-4xl font-black text-amber-500">140+</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1.5">
              Partner Supermarkets
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="text-3xl sm:text-4xl font-black text-blue-600">100% FEFO</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1.5">
              Verified Freshness
            </div>
          </div>
        </div>
      </section>

      {/* The Story Behind NearExpiry */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 sm:p-12 md:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-bold text-brand-700 uppercase tracking-wider">
                <Leaf className="w-3.5 h-3.5 text-brand-600" />
                The Problem & Our Innovation
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight">
                Why Does Safe Food End Up in Dumpsters?
              </h2>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Every single day, grocery retailers discard perfectly fresh dairy, pantry goods, organic snacks, and household essentials simply because their static inventory system flags them as approaching expiry dates in 3 to 7 days.
              </p>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Meanwhile, millions of everyday households face rising living and grocery expenses. NearExpiry was created to fix this broken pipeline by building an automated, real-time marketplace that turns impending inventory loss into affordable nutrition for families.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 font-medium">
                    Strict First-Expired-First-Out (FEFO) batch inventory tracking
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 font-medium">
                    Automated price drop curves ranging from 10% up to 75% discount
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 font-medium">
                    Cryptographic QR tokens for verified customer pickup and order safety
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-inner">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                The Triple-Win Equation
              </h3>

              <div className="space-y-4">
                <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="font-bold text-sm text-brand-700 flex items-center gap-2">
                    <Store className="w-4 h-4 text-brand-600" /> For Retailers & Supermarkets
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Recovers invested inventory cost and boosts footfall instead of booking 100% loss write-offs.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="font-bold text-sm text-amber-700 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-600" /> For Everyday Shoppers
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Enjoy genuine, branded, quality groceries and pantry essentials with up to 75% verified price reductions.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="font-bold text-sm text-emerald-700 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" /> For Our Planet
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Drastically decreases landfill methane emissions and champions a sustainable circular urban economy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our 4 Core Commitments */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            Our Guiding Pillars
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            The foundation of everything we engineer at NearExpiry
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-gray-900 mb-2">100% Transparency</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Every single product lists exact batch numbers, manufacturing dates, and verified expiry windows upfront.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-gray-900 mb-2">Dynamic Price Radar</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Our automated engine recalculates pricing daily so customers get increasing discounts as expiry draws near.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-gray-900 mb-2">Hyperlocal Community</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              We empower local independent supermarkets and store owners by connecting them with nearby neighborhood buyers.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-gray-900 mb-2">Cryptographic QR Pickup</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Orders are fulfilled through single-scan QR tokens guaranteeing contactless, secure, and accurate handoffs.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-brand-700 via-emerald-800 to-slate-900 text-white p-8 sm:p-12 text-center shadow-xl space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
            Ready to Join the Grocery Rescue Movement?
          </h2>
          <p className="text-sm sm:text-base text-emerald-100 max-w-xl mx-auto">
            Whether you want to save on your weekly grocery bill or help your store eliminate inventory loss, NearExpiry is built for you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/marketplace"
              className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2"
            >
              Browse Today's Deals
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/register-seller"
              className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              Register as Store Partner
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutUsPage;
