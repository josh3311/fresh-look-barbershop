// Set min date for booking
document.getElementById('date').min = new Date().toISOString().split('T')[0];

function openModal() {
  document.getElementById('bookingModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('bookingModal').classList.remove('active');
  document.body.style.overflow = '';
  // Reset form after close
  setTimeout(() => {
    document.getElementById('bookingForm').style.display = '';
    document.getElementById('bookingSuccess').style.display = 'none';
    document.getElementById('bookingForm').reset();
  }, 300);
}

// Close modal on overlay click
document.getElementById('bookingModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

function submitBooking(e) {
  e.preventDefault();
  document.getElementById('bookingForm').style.display = 'none';
  document.getElementById('bookingSuccess').style.display = 'block';
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  const wasActive = item.classList.contains('active');
  // Close all
  document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.faq-question').forEach(el => el.setAttribute('aria-expanded', 'false'));
  // Open clicked if it wasn't active
  if (!wasActive) {
    item.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
  }
}

function toggleMenu() {
  document.querySelector('nav').classList.toggle('open');
}

// Close mobile menu on nav click
document.querySelectorAll('nav a:not(.btn-book)').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelector('nav').classList.remove('open');
  });
});

// Smooth scroll offset for sticky header
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const offset = 72;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});