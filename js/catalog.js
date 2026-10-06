// version: 1.0.0
// Storefront catalog data. Kept free of DOM/rendering concerns so the product
// list can later be swapped for an API response without touching the UI layer.
(function (global) {
  "use strict";

  /** Brand categories, in the order they appear in the navigation. */
  const BRANDS = [
    { id: "loreal-elvive", label: "Loreal elvive" },
    { id: "skala", label: "SKALA" },
    { id: "dr-althea", label: "Dr althea" },
    { id: "dr-clinic", label: "Dr clinic" },
    { id: "revuele", label: "revuele" },
    { id: "vichy", label: "vichy" },
    { id: "panoxyl", label: "panoxyl" },
    { id: "kahi", label: "Kahi" },
    { id: "cosmo", label: "Cosmo" },
    { id: "ellinia", label: "Ellinia" },
  ];

  /**
   * Products. `price` is a plain number in Iraqi Dinar; formatting is a view
   * concern and happens at render time. `brandId` must match a BRANDS id.
   */
  const PRODUCTS = [
    {
      id: "cosmo-scrub-fruit-burst",
      title: "Cosmo face and body scrub fruit burst",
      brandId: "cosmo",
      price: 8500,
      inStock: true,
    },
    {
      id: "cosmo-scrub-coffee",
      title: "Cosmo face and body scrub coffee",
      brandId: "cosmo",
      price: 8500,
      inStock: true,
    },
    {
      id: "loreal-elvive-shampoo-total-repair",
      title: "L'Oréal Elvive Total Repair 5 Shampoo 400ml",
      brandId: "loreal-elvive",
      price: 12000,
      inStock: true,
    },
    {
      id: "loreal-elvive-hyaluron-serum",
      title: "L'Oréal Elvive Hyaluron Pure Hair Serum",
      brandId: "loreal-elvive",
      price: 15500,
      inStock: false,
    },
    {
      id: "skala-cachos-mask",
      title: "SKALA Mais Cachos Curl Definition Mask 1kg",
      brandId: "skala",
      price: 18000,
      inStock: true,
    },
    {
      id: "skala-bomba-mask",
      title: "SKALA Bomba de Vitaminas Hair Mask 1kg",
      brandId: "skala",
      price: 18000,
      inStock: true,
    },
    {
      id: "dr-althea-147-cream",
      title: "Dr. Althea 147 Barrier Cream 50ml",
      brandId: "dr-althea",
      price: 32000,
      inStock: true,
    },
    {
      id: "dr-althea-345-relief",
      title: "Dr. Althea 345 Relief Cream",
      brandId: "dr-althea",
      price: 29000,
      inStock: false,
    },
    {
      id: "dr-clinic-vitamin-c-serum",
      title: "Dr. Clinic Vitamin C Brightening Serum 30ml",
      brandId: "dr-clinic",
      price: 11000,
      inStock: true,
    },
    {
      id: "dr-clinic-snail-cream",
      title: "Dr. Clinic Snail Repair Face Cream",
      brandId: "dr-clinic",
      price: 13500,
      inStock: true,
    },
    {
      id: "revuele-niacinamide-serum",
      title: "Revuele Niacinamide Pore Refining Serum",
      brandId: "revuele",
      price: 9500,
      inStock: true,
    },
    {
      id: "revuele-charcoal-mask",
      title: "Revuele Charcoal Peel Off Mask 80ml",
      brandId: "revuele",
      price: 7000,
      inStock: true,
    },
    {
      id: "vichy-mineral-89",
      title: "Vichy Minéral 89 Hyaluronic Booster 50ml",
      brandId: "vichy",
      price: 48000,
      inStock: true,
    },
    {
      id: "vichy-dercos-shampoo",
      title: "Vichy Dercos Anti-Dandruff Shampoo 200ml",
      brandId: "vichy",
      price: 27500,
      inStock: false,
    },
    {
      id: "panoxyl-acne-wash",
      title: "PanOxyl Acne Foaming Wash 10% Benzoyl Peroxide",
      brandId: "panoxyl",
      price: 21000,
      inStock: true,
    },
    {
      id: "panoxyl-acne-bar",
      title: "PanOxyl Acne Creamy Wash 4%",
      brandId: "panoxyl",
      price: 19500,
      inStock: true,
    },
    {
      id: "kahi-multi-balm",
      title: "Kahi Wrinkle Bounce Multi Balm 9g",
      brandId: "kahi",
      price: 36000,
      inStock: true,
    },
    {
      id: "kahi-seoul-sun-stick",
      title: "Kahi Seoul Wrinkle Bounce Sun Stick",
      brandId: "kahi",
      price: 34000,
      inStock: false,
    },
    {
      id: "ellinia-rose-water",
      title: "Ellinia Rose Water Facial Toner 250ml",
      brandId: "ellinia",
      price: 6500,
      inStock: true,
    },
    {
      id: "ellinia-body-lotion",
      title: "Ellinia Shea Butter Body Lotion 400ml",
      brandId: "ellinia",
      price: 9000,
      inStock: true,
    },
  ];

  global.AkadCatalog = { BRANDS, PRODUCTS };
})(window);
