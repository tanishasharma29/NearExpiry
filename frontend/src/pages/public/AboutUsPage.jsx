import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Leaf,
  Store,
  ShoppingCart,
  ArrowRight,
  Sparkles,
  Users,
  RefreshCw,
  Tag,
  Package,
  Calendar,
  Percent,
  DollarSign,
  Heart,
  ChevronRight,
  Zap,
} from 'lucide-react';

/**
 * AboutUsPage
 *
 * Polished, production-ready About Us page for NearExpiry.
 * Faithfully follows the requested structure, reference design, and brand aesthetics:
 * - Clean warm/cream background with subtle green ambient gradients & floating leaves
 * - SECTION 1: ABOUT HERO (Badge, bold heading, text, CTA buttons, multi-category box visual & 4 floating info cards)
 * - SECTION 2: IMPACT / VALUE CARDS (4 horizontal cards with micro-hover & icons)
 * - SECTION 3: OUR MISSION (Asymmetric 2-column with sustainability photo & 3 benefit rows)
 * - SECTION 4: OUR IMPACT (Centered heading & 4 impact metric cards)
 * - SECTION 5: HOW NEAREXPIRY WORKS (Horizontal process timeline with numbered circles & dashed connector lines)
 * - SECTION 6: OUR STORY (Editorial split with story text, CTA & marketplace box visual)
 * - SECTION 7: FINAL CTA (Deep NearExpiry green background with subtle floating leaves)
 */
export const AboutUsPage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef(null);

  // Scroll to top on mount & trigger entry reveal
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#fcfdfa] text-gray-900 overflow-hidden relative selection:bg-emerald-100 selection:text-emerald-900">
      {/* Ambient background soft glow orbs */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-emerald-100/40 rounded-full blur-3xl pointer-events-none -mr-40 -mt-20" />
      <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-green-50/50 rounded-full blur-3xl pointer-events-none -ml-40" />
      <div className="absolute bottom-1/4 right-0 w-[600px] h-[600px] bg-emerald-50/40 rounded-full blur-3xl pointer-events-none -mr-48" />

      {/* Decorative floating soft leaves across the page */}
      <div className="absolute top-32 left-8 text-emerald-400/25 pointer-events-none animate-float-gentle hidden lg:block">
        <Leaf className="w-8 h-8 rotate-12" />
      </div>
      <div className="absolute top-96 right-12 text-emerald-500/20 pointer-events-none animate-float-gentle-reverse hidden lg:block">
        <Leaf className="w-6 h-6 -rotate-45" />
      </div>
      <div className="absolute top-[1600px] left-10 text-emerald-400/25 pointer-events-none animate-float-gentle hidden lg:block">
        <Leaf className="w-7 h-7 rotate-45" />
      </div>
      <div className="absolute top-[2300px] right-8 text-emerald-500/20 pointer-events-none animate-float-gentle-reverse hidden lg:block">
        <Leaf className="w-9 h-9 -rotate-12" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-16 sm:space-y-20 lg:space-y-24 relative z-10">

        {/* ========================================================
            BREADCRUMBS
            ======================================================== */}
        <nav aria-label="Breadcrumb" className="pt-2">
          <ol className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <li>
              <Link to="/" className="hover:text-emerald-700 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </li>
            <li className="text-emerald-700 font-bold" aria-current="page">
              About Us
            </li>
          </ol>
        </nav>

        {/* ========================================================
            SECTION 1 — ABOUT HERO
            ======================================================== */}
        <section
          ref={heroRef}
          className={`transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/90 text-xs font-bold text-emerald-800 shadow-sm">
                <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                <span>About NearExpiry</span>
              </div>

              {/* Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight leading-[1.1]">
                Turning <br />
                Near-Expiry <br />
                <span className="text-[#16a34a]">Into New Value</span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed font-normal max-w-xl">
                NearExpiry connects businesses with smart shoppers to give surplus and near-expiry products a second chance — helping reduce waste while making everyday essentials more affordable.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/marketplace"
                  className="px-6 py-3.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-2 group"
                >
                  <span>Explore Today's Deals</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/register-seller"
                  className="px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm rounded-xl border border-gray-200 transition-all duration-200 shadow-sm hover:shadow flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-emerald-600" />
                  <span>Become a Seller</span>
                </Link>
              </div>
            </div>

            {/* Right Marketplace Visual with Floating Cards */}
            <div className="lg:col-span-6 relative flex items-center justify-center pt-4 lg:pt-0">
              {/* Radial backdrop glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-100/60 via-green-100/40 to-amber-100/30 rounded-3xl blur-2xl transform scale-95 pointer-events-none" />

              {/* Main Visual Box Card */}
              <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-3 sm:p-4 border border-emerald-100/80 shadow-xl overflow-visible">
                {/* Product Box Image */}
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100">
                  <img
                    src="/images/banners/banner1-NearExpiry.jpg"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
                    }}
                    alt="NearExpiry Multi-category Surplus Marketplace Box"
                    className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
                  />
                  {/* Subtle gradient vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/30 via-transparent to-transparent pointer-events-none" />

                  {/* Brand Tag on Box */}
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/60 shadow-md flex items-center gap-1.5">
                    <span className="text-emerald-700 font-black text-xs tracking-tight flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" /> NearExpiry Box
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">Multi-Category</span>
                  </div>
                </div>

                {/* Floating Card 1: Top Left - Everyday Essentials */}
                <div className="absolute -top-4 -left-4 sm:-top-5 sm:-left-6 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-amber-100 shadow-lg flex items-center gap-3 animate-float-gentle z-20">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Everyday Essentials</div>
                    <div className="text-[10px] text-gray-500 font-medium">Pantry & Household</div>
                  </div>
                </div>

                {/* Floating Card 2: Top Right - Reduce Waste */}
                <div className="absolute -top-4 -right-4 sm:-top-5 sm:-right-6 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-emerald-100 shadow-lg flex items-center gap-3 animate-float-gentle-reverse z-20">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Reduce Waste</div>
                    <div className="text-[10px] text-gray-500 font-medium">Zero Waste Goal</div>
                  </div>
                </div>

                {/* Floating Card 3: Middle Right - Better Deals */}
                <div className="absolute top-1/2 -right-5 sm:-right-8 transform -translate-y-1/2 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-orange-100 shadow-lg flex items-center gap-3 animate-float-gentle z-20 hidden sm:flex">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Better Deals</div>
                    <div className="text-[10px] text-gray-500 font-medium">Up to 75% Off</div>
                  </div>
                </div>

                {/* Floating Card 4: Bottom Right - Support Local Sellers */}
                <div className="absolute -bottom-4 -right-4 sm:-bottom-5 sm:-right-6 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-blue-100 shadow-lg flex items-center gap-3 animate-float-gentle-reverse z-20">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">Support Sellers</div>
                    <div className="text-[10px] text-gray-500 font-medium">Local Supermarkets</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 2 — IMPACT / VALUE CARDS (4 Horizontal Cards)
            ======================================================== */}
        <section className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Multiple Categories */}
            <div className="group bg-white p-6 rounded-2xl border border-gray-100/90 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-1.5 group-hover:text-emerald-700 transition-colors">
                Multiple Categories
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed font-normal">
                Groceries, personal care, medicine, daily essentials and more.
              </p>
            </div>

            {/* Card 2: Less Product Waste */}
            <div className="group bg-white p-6 rounded-2xl border border-gray-100/90 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-1.5 group-hover:text-green-700 transition-colors">
                Less Product Waste
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed font-normal">
                Giving good products a second chance before disposal.
              </p>
            </div>

            {/* Card 3: Better Deals */}
            <div className="group bg-white p-6 rounded-2xl border border-gray-100/90 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Tag className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-1.5 group-hover:text-amber-700 transition-colors">
                Better Deals
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed font-normal">
                Quality products at dynamically discounted affordable prices.
              </p>
            </div>

            {/* Card 4: Support Local Sellers */}
            <div className="group bg-white p-6 rounded-2xl border border-gray-100/90 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-1.5 group-hover:text-blue-700 transition-colors">
                Support Local Sellers
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed font-normal">
                Helping businesses recover value from surplus stock and inventory.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 3 — OUR MISSION (Asymmetric Two-Column)
            ======================================================== */}
        <section className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Environmental Concept Image */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border border-emerald-100/80 aspect-[4/3] sm:aspect-square lg:aspect-[4/4.5] bg-gray-100 group">
                <img
                  src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=900&q=80"
                  alt="Hands holding green earth seedling representing environmental sustainability"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent pointer-events-none" />

                {/* Hand-style sustainability badge at bottom right */}
                <div className="absolute bottom-5 right-5 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/70 shadow-lg flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 tracking-tight">
                    A Greener & Brighter Tomorrow
                  </span>
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Right Column: Mission Content & 3 Animated Benefit Rows */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                <span>Our Mission</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-snug">
                A More Sustainable <br />
                <span className="text-[#16a34a]">Marketplace for Everyone</span>
              </h2>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-normal">
                We aim to create a sustainable and affordable marketplace where surplus and near-expiry products reach the right people — reducing preventable waste while adding value for both consumers and businesses.
              </p>

              {/* 3 Animated Benefit Rows */}
              <div className="space-y-4 pt-2">
                {/* Row 1: Save Products */}
                <div className="flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all duration-200">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Leaf className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-gray-900 mr-2">Save Products</span>
                    <span className="text-xs text-gray-500 font-medium">before they go to waste</span>
                  </div>
                </div>

                {/* Row 2: Save Money */}
                <div className="flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-amber-200 hover:shadow-md transition-all duration-200">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 shadow-xs">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-gray-900 mr-2">Save Money</span>
                    <span className="text-xs text-gray-500 font-medium">with dynamic discounts</span>
                  </div>
                </div>

                {/* Row 3: Support Sellers */}
                <div className="flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-rose-200 hover:shadow-md transition-all duration-200">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-gray-900 mr-2">Support Sellers</span>
                    <span className="text-xs text-gray-500 font-medium">by recovering value from inventory</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 4 — OUR IMPACT (Centered with 4 Impact Cards)
            ======================================================== */}
        <section className="pt-4 text-center">
          <div className="max-w-2xl mx-auto space-y-3 mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Our Impact</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Small Choices. <span className="text-[#16a34a]">A Bigger Impact.</span>
            </h2>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-normal">
              Together with our sellers and shoppers, we are creating positive change — one product at a time.
            </p>
          </div>

          {/* 4 Impact Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {/* Card 1: Core Categories */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">3+</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Core Categories
              </div>
            </div>

            {/* Card 2: Sellers & Distributors */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-700 tracking-tight">B2B+</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sellers & Distributors
              </div>
            </div>

            {/* Card 3: Less Preventable Waste */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-black text-teal-700 tracking-tight">Less</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Preventable Waste
              </div>
            </div>

            {/* Card 4: Dates Shown Upfront */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-black text-rose-700 tracking-tight">Dates</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Shown Upfront
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 5 — HOW NEAREXPIRY WORKS (Timeline Process)
            ======================================================== */}
        <section className="pt-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-200/80 p-8 sm:p-12 shadow-sm text-center">
            {/* Header */}
            <div className="max-w-2xl mx-auto space-y-3 mb-12">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>How It Works</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                Bringing Surplus Products to the Right People
              </h2>

              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-normal">
                We make it simple for businesses to list near-expiry products and for shoppers to discover great deals — all while reducing waste.
              </p>
            </div>

            {/* 4 Process Steps with Connecting Dashed Lines */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              {/* Step 1: Sellers List Products */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="relative mb-5">
                  <div className="w-14 h-14 rounded-full bg-emerald-500 text-white font-black text-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Store className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-emerald-500 text-emerald-800 text-[11px] font-black flex items-center justify-center shadow-xs">
                    1
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 mb-2">Sellers List Products</h3>
                <p className="text-xs text-gray-500 leading-relaxed font-normal max-w-xs">
                  Manufacturers, distributors and local stores list near-expiry and surplus items.
                </p>
              </div>

              {/* Step 2: Smart Discounting */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="relative mb-5">
                  <div className="w-14 h-14 rounded-full bg-amber-500 text-white font-black text-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Percent className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-amber-500 text-amber-800 text-[11px] font-black flex items-center justify-center shadow-xs">
                    2
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 mb-2">Smart Discounting</h3>
                <p className="text-xs text-gray-500 leading-relaxed font-normal max-w-xs">
                  Products are offered at dynamic discounts based on expiry dates.
                </p>
              </div>

              {/* Step 3: Customers Discover */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="relative mb-5">
                  <div className="w-14 h-14 rounded-full bg-blue-500 text-white font-black text-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-blue-500 text-blue-800 text-[11px] font-black flex items-center justify-center shadow-xs">
                    3
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 mb-2">Customers Discover</h3>
                <p className="text-xs text-gray-500 leading-relaxed font-normal max-w-xs">
                  Shoppers find genuine deals on everyday essentials.
                </p>
              </div>

              {/* Step 4: Less Waste, More Value */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="relative mb-5">
                  <div className="w-14 h-14 rounded-full bg-purple-600 text-white font-black text-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Leaf className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-purple-600 text-purple-800 text-[11px] font-black flex items-center justify-center shadow-xs">
                    4
                  </span>
                </div>
                <h3 className="font-bold text-base text-gray-900 mb-2">Less Waste, More Value</h3>
                <p className="text-xs text-gray-500 leading-relaxed font-normal max-w-xs">
                  Products find new homes instead of going to waste.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 6 — OUR STORY (Editorial Split Section)
            ======================================================== */}
        <section className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Story Text */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-xs font-bold text-purple-800">
                <Heart className="w-3.5 h-3.5 text-purple-600" />
                <span>Our Story</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-snug">
                Built for a More <br />
                <span className="text-[#16a34a]">Responsible Tomorrow</span>
              </h2>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-normal">
                NearExpiry started with a simple idea — to reduce preventable waste and make quality products more accessible. We connect manufacturers, distributors and local businesses with conscious shoppers, creating a win-win for people, businesses and the planet.
              </p>

              <div className="pt-2">
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-200 group"
                >
                  <span>Explore Marketplace</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Right Story Visual */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border border-gray-200 aspect-[4/3] bg-gray-100 group">
                <img
                  src="/images/banners/banner1-NearExpiry.jpg"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
                  }}
                  alt="NearExpiry grocery and daily essentials rescue packaging"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent pointer-events-none" />

                {/* Floating Card on Right: Good Products Deserve a Second Chance */}
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/70 shadow-lg flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-900">
                    Good Products Deserve a Second Chance.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 7 — FINAL CTA
            ======================================================== */}
        <section className="pt-4 pb-8">
          <div className="rounded-3xl bg-gradient-to-br from-[#0c3820] via-[#14532d] to-[#082817] text-white p-8 sm:p-12 md:p-16 text-center shadow-2xl relative overflow-hidden space-y-6">
            {/* Ambient decorative glow particles */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                <span>Join the Movement</span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                Good Products Deserve a <br />
                <span className="text-emerald-300">Second Chance.</span>
              </h2>

              <p className="text-sm sm:text-base text-emerald-100/90 font-normal">
                Shop smarter. Save more. Waste less.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <Link
                  to="/marketplace"
                  className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-2 group"
                >
                  <span>Explore Today's Deals</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/register-seller"
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  <span>Become a Seller</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default AboutUsPage;
