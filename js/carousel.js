(function (global) {
  "use strict";

  function initCarousel() {
    const track = document.getElementById("carousel-track");
    const dotsContainer = document.getElementById("carousel-dots");
    const prevButton = document.querySelector(".carousel__button--prev");
    const nextButton = document.querySelector(".carousel__button--next");
    const carousel = document.getElementById("main-carousel");

    if (!track || !carousel) return;

    if (global.carouselTimer) {
      clearInterval(global.carouselTimer);
    }
    dotsContainer.replaceChildren();

    const slides = Array.from(track.children);
    let currentIndex = 0;
    let timer = null;
    const interval = 4000;

    // Create dots
    slides.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.className = "carousel__dot";
      if (index === 0) dot.classList.add("carousel__dot--active");
      dot.setAttribute("aria-label", `شريحة ${index + 1}`);
      dot.addEventListener("click", () => goToSlide(index));
      dotsContainer.appendChild(dot);
    });
    const dots = Array.from(dotsContainer.children);

    function updateCarousel() {
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      dots.forEach((dot, index) => {
        dot.classList.toggle("carousel__dot--active", index === currentIndex);
      });
    }

    function goToSlide(index) {
      currentIndex = index;
      if (currentIndex < 0) currentIndex = slides.length - 1;
      if (currentIndex >= slides.length) currentIndex = 0;
      updateCarousel();
      resetTimer();
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    function startTimer() {
      if (!global.carouselTimer) {
        global.carouselTimer = setInterval(nextSlide, interval);
      }
    }

    function stopTimer() {
      if (global.carouselTimer) {
        clearInterval(global.carouselTimer);
        global.carouselTimer = null;
      }
    }

    function resetTimer() {
      stopTimer();
      startTimer();
    }

    prevButton.addEventListener("click", prevSlide);
    nextButton.addEventListener("click", nextSlide);

    carousel.addEventListener("mouseenter", stopTimer);
    carousel.addEventListener("mouseleave", startTimer);

    // Initial setup
    startTimer();
  }

  global.AkadCarousel = { init: initCarousel };
})(window);
