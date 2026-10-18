import type { Business, Industry } from "../types.ts";

// Every word a visitor can see, per language. Spanish is first-class because
// the target market is Venezuela; English is the fallback for everything else.

export type Locale = "es" | "en";

const SPANISH_COUNTRIES = new Set(["VE", "CO", "MX", "AR", "CL", "PE", "EC", "BO", "PY", "UY", "PA", "CR", "DO", "GT", "HN", "NI", "SV", "CU", "PR", "ES"]);

export function localeFor(b: Pick<Business, "country" | "language">): Locale {
  if (b.language === "es" || b.language === "en") return b.language;
  return b.country && SPANISH_COUNTRIES.has(b.country.toUpperCase()) ? "es" : "en";
}

export interface IndustryText {
  label: string;
  article: string; // indefinite article for label: un/una, a/an
  offerLabel: string;
  offerPage: string; // URL slug of the dedicated offer page
  bookingLabel: string | null; // null = no booking section
  bookingDetailLabel: string; // second field in the booking form
  ctaFallback: string;
  highlights: { title: string; text: string }[];
  services: { name: string; description: string }[];
  faq: { q: string; a: string }[];
}

export interface UiText {
  nav: { about: string; visit: string; contact: string; book: string; menuToggle: string };
  skip: string;
  seeFull: (offer: string) => string;
  about: string;
  aboutFallback: (name: string, labelWithArticle: string, where: string) => string;
  heroFallback: (label: string, where: string) => string;
  inside: (name: string) => string;
  photo: (name: string, n: number) => string;
  photoPlaceholder: (label: string) => string;
  gallery: string;
  form: { name: string; contact: string; date: string; time: string; message: string; send: string; sendWhatsApp: string; sendInstagram: string; consent: string; privacyLink: string; confirmedBy: (name: string) => string; orCall: string; required: string };
  formResult: { demo: string; demoMessage: string; demoInstagram: string; mailFallback: string; opened: string; openedInstagram: string };
  visit: string;
  hours: string;
  hoursTbd: string;
  findUs: string;
  openMap: string;
  findOnMap: string;
  showMap: string;
  mapNote: string;
  mapNoteGoogle: string;
  addressTbd: string;
  faq: string;
  faqTitle: string;
  contactTitle: string;
  call: string;
  email: string;
  writeWhatsApp: string;
  writeInstagram: string;
  whatsappFloat: string;
  privacy: string;
  privacyPage: (name: string, address: string | undefined, email: string | undefined) => string;
  demoBanner: (agency: string, business: string, removeHref: string) => string;
  bookingMessage: (business: string, fields: string) => string;
  days: string[]; // Mo..Su
  closed: string;
  allDay: string;
  holidays: string;
  notFoundTitle: string;
  notFoundText: string;
  backHome: string;
  in: string;
}

const es: UiText = {
  nav: { about: "Nosotros", visit: "Visítanos", contact: "Contacto", book: "Reservar", menuToggle: "Menú" },
  skip: "Ir al contenido",
  seeFull: () => "Ver la lista completa →",
  about: "Nosotros",
  aboutFallback: (n, l, w) => `${n} es ${l}${w}. Visítanos o escríbenos para conocer todo lo que ofrecemos.`,
  heroFallback: (l, w) => `${l}${w}. Te esperamos.`,
  inside: (n) => `Dentro de ${n}`,
  photo: (n, i) => `${n}, foto ${i}`,
  photoPlaceholder: (l) => `${l} — aquí va tu foto`,
  gallery: "Galería",
  form: {
    name: "Nombre",
    contact: "Teléfono o correo",
    date: "Fecha",
    time: "Hora",
    message: "Mensaje",
    send: "Enviar solicitud",
    sendWhatsApp: "Enviar por WhatsApp",
    sendInstagram: "Enviar por Instagram",
    consent: "Acepto que usen mis datos para responder esta solicitud, según el",
    privacyLink: "aviso de privacidad",
    confirmedBy: (n) => `${n} confirmará tu solicitud`,
    orCall: "o llama al",
    required: "Por favor completa los campos obligatorios.",
  },
  formResult: {
    demo: "Vista previa: en el sitio publicado, este botón abrirá WhatsApp con este mensaje listo para enviar:",
    demoMessage: "Vista previa: en el sitio publicado, este botón enviará la solicitud por correo.",
    demoInstagram: "Vista previa: en el sitio publicado, este botón copia este mensaje y abre el chat de Instagram para que lo pegues:",
    mailFallback: "Se abrió tu aplicación de correo con la solicitud. Si no se abrió, escríbenos directamente.",
    opened: "¡Listo! Se abrió WhatsApp con tu solicitud. Solo tienes que presionar enviar.",
    openedInstagram: "Copiamos tu mensaje. Pégalo en el chat de Instagram que se abrió y envíalo.",
  },
  visit: "Visítanos",
  hours: "Horario",
  hoursTbd: "Horario por confirmar.",
  findUs: "Cómo llegar",
  openMap: "Abrir mapa",
  findOnMap: "Buscar en el mapa",
  showMap: "Mostrar mapa interactivo",
  mapNote: "Carga un mapa de OpenStreetMap.",
  mapNoteGoogle: "Carga un mapa de Google Maps.",
  addressTbd: "Dirección por confirmar.",
  faq: "Preguntas frecuentes",
  faqTitle: "Bueno saber",
  contactTitle: "Contáctanos",
  call: "Llámanos al",
  email: "Escríbenos a",
  writeWhatsApp: "Escríbenos por WhatsApp",
  writeInstagram: "Escríbenos por Instagram",
  whatsappFloat: "Escríbenos por WhatsApp",
  privacy: "Privacidad",
  privacyPage: (n, addr, email) => `<h1>Aviso de privacidad</h1>
<h2>Quiénes somos</h2><p>${n}${addr ? `, ${addr}` : ""}, es responsable de los datos personales recibidos a través de este sitio web.</p>
<h2>Qué datos recibimos y para qué</h2><p>Cuando nos envías una solicitud (por WhatsApp, correo o formulario) usamos los datos que nos das —nombre, contacto y mensaje— únicamente para responderte y gestionar tu reserva o cita.</p>
<h2>Cuánto tiempo los guardamos</h2><p>Solo el tiempo necesario para atender tu solicitud.</p>
<h2>Terceros</h2><p>Las fuentes tipográficas se cargan desde Google Fonts y el mapa, solo si decides mostrarlo, desde OpenStreetMap o Google Maps. Si nos escribes por WhatsApp, aplica también la política de privacidad de WhatsApp. Este sitio no usa cookies de seguimiento.</p>
<h2>Tus derechos</h2><p>Puedes pedirnos ver, corregir o eliminar tus datos en cualquier momento${email ? ` escribiendo a <a href="mailto:${email}">${email}</a>` : ""}.</p>`,
  demoBanner: (a, b, href) => `Vista previa conceptual preparada por ${a} para ${b}. No es el sitio oficial ni está aprobado por ${b}. <a href="${href}">Pedir que la eliminemos</a>.`,
  bookingMessage: (b, f) => `Hola ${b}, quisiera hacer una solicitud desde su página web:\n${f}`,
  days: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  closed: "Cerrado",
  allDay: "Abierto las 24 horas",
  holidays: "Feriados",
  notFoundTitle: "Página no encontrada",
  notFoundText: "La página que buscas no existe o fue movida.",
  backHome: "Volver al inicio",
  in: " en ",
};

const en: UiText = {
  nav: { about: "About", visit: "Visit", contact: "Contact", book: "Book", menuToggle: "Menu" },
  skip: "Skip to content",
  seeFull: (o) => `See the full ${o.toLowerCase()} →`,
  about: "About",
  aboutFallback: (n, l, w) => `${n} is ${l}${w}. Visit us or get in touch to find out everything we offer.`,
  heroFallback: (l, w) => `${l}${w}. We'd love to see you.`,
  inside: (n) => `Inside ${n}`,
  photo: (n, i) => `${n} photo ${i}`,
  photoPlaceholder: (l) => `${l} — your photo here`,
  gallery: "Gallery",
  form: {
    name: "Name",
    contact: "Phone or email",
    date: "Date",
    time: "Time",
    message: "Message",
    send: "Send request",
    sendWhatsApp: "Send via WhatsApp",
    sendInstagram: "Send via Instagram",
    consent: "I agree to my details being used to answer this request, as described in the",
    privacyLink: "privacy notice",
    confirmedBy: (n) => `${n} will confirm your request`,
    orCall: "or call",
    required: "Please fill in the required fields.",
  },
  formResult: {
    demo: "Preview: on the published site, this button opens WhatsApp with this message ready to send:",
    demoMessage: "Preview: on the published site, this button sends the request by email.",
    demoInstagram: "Preview: on the published site, this button copies this message and opens the Instagram chat so you can paste it:",
    mailFallback: "Your email app opened with the request. If it didn't, please email us directly.",
    opened: "Done! WhatsApp opened with your request — just press send.",
    openedInstagram: "We copied your message. Paste it into the Instagram chat that just opened and send it.",
  },
  visit: "Visit",
  hours: "Opening hours",
  hoursTbd: "Opening hours to be confirmed.",
  findUs: "Find us",
  openMap: "Open map",
  findOnMap: "Find on map",
  showMap: "Show interactive map",
  mapNote: "Loads a map from OpenStreetMap.",
  mapNoteGoogle: "Loads a map from Google Maps.",
  addressTbd: "Address to be confirmed.",
  faq: "FAQ",
  faqTitle: "Good to know",
  contactTitle: "Get in touch",
  call: "Call",
  email: "Email",
  writeWhatsApp: "Message us on WhatsApp",
  writeInstagram: "Message us on Instagram",
  whatsappFloat: "Message us on WhatsApp",
  privacy: "Privacy",
  privacyPage: (n, addr, email) => `<h1>Privacy notice</h1>
<h2>Who we are</h2><p>${n}${addr ? `, ${addr}` : ""} is responsible for personal data received through this website.</p>
<h2>What we receive and why</h2><p>When you send us a request (by WhatsApp, email or form) we use the details you give us — name, contact details and message — only to answer you and manage your booking.</p>
<h2>How long we keep it</h2><p>Only as long as needed to handle your request.</p>
<h2>Third parties</h2><p>Fonts load from Google Fonts; the map loads from OpenStreetMap or Google Maps only if you choose to show it. If you message us on WhatsApp, WhatsApp's privacy policy also applies. This site uses no tracking cookies.</p>
<h2>Your rights</h2><p>You can ask us to see, correct or delete your data at any time${email ? ` by writing to <a href="mailto:${email}">${email}</a>` : ""}.</p>`,
  demoBanner: (a, b, href) => `Concept preview prepared by ${a} for ${b}. Not an official website and not approved by ${b}. <a href="${href}">Ask us to remove it</a>.`,
  bookingMessage: (b, f) => `Hi ${b}, I'd like to make a request from your website:\n${f}`,
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  closed: "Closed",
  allDay: "Open 24 hours",
  holidays: "Public holidays",
  notFoundTitle: "Page not found",
  notFoundText: "The page you're looking for doesn't exist or has moved.",
  backHome: "Back to home",
  in: " in ",
};

export const UI: Record<Locale, UiText> = { es, en };

const enIndustry: Record<Industry, IndustryText> = {
  restaurant: {
    label: "Restaurant", article: "a", offerLabel: "Menu", offerPage: "menu", bookingLabel: "Reserve a table", bookingDetailLabel: "Guests", ctaFallback: "Book a table",
    highlights: [
      { title: "Seasonal cooking", text: "Dishes built around what's fresh and good right now." },
      { title: "A place to linger", text: "Relaxed service, good company and room to take your time." },
      { title: "Made for occasions", text: "From weeknight dinners to celebrations with friends." },
    ],
    services: [
      { name: "Starters", description: "A rotating selection of small plates to share." },
      { name: "Mains", description: "Our signature dishes, prepared fresh to order." },
      { name: "Desserts", description: "Something sweet to finish." },
    ],
    faq: [
      { q: "Do I need to book in advance?", a: "Walk-ins are welcome when there is space; booking ahead guarantees your table, especially on weekends." },
      { q: "Do you cater for dietary requirements?", a: "Let us know about allergies or dietary needs when you book and we'll do our best to accommodate you." },
    ],
  },
  cafe: {
    label: "Café", article: "a", offerLabel: "Menu", offerPage: "menu", bookingLabel: null, bookingDetailLabel: "Guests", ctaFallback: "See the menu",
    highlights: [
      { title: "Good coffee", text: "Carefully prepared, every cup." },
      { title: "Baked daily", text: "Fresh pastries and treats from the morning on." },
      { title: "Stay a while", text: "A friendly spot to meet, work or slow down." },
    ],
    services: [
      { name: "Coffee & tea", description: "Espresso drinks, filter coffee and loose-leaf teas." },
      { name: "Breakfast", description: "Simple, satisfying plates to start the day." },
      { name: "Cakes & pastries", description: "Baked fresh and changing with the season." },
    ],
    faq: [{ q: "Do you have seating?", a: "Yes — come in and make yourself comfortable." }],
  },
  bar: {
    label: "Bar", article: "a", offerLabel: "Drinks", offerPage: "drinks", bookingLabel: "Book a table", bookingDetailLabel: "Guests", ctaFallback: "Book a table",
    highlights: [
      { title: "Crafted drinks", text: "Classics done right and house creations worth the trip." },
      { title: "Atmosphere", text: "Good music, good people, good nights." },
      { title: "Private events", text: "Ask us about hosting your next celebration." },
    ],
    services: [
      { name: "Cocktails", description: "House signatures and timeless classics." },
      { name: "Wine & beer", description: "A considered selection by the glass and bottle." },
      { name: "Bites", description: "Small plates to share." },
    ],
    faq: [{ q: "Can I book for a group?", a: "Yes — send us a booking request with your group size and date." }],
  },
  hotel: {
    label: "Hotel", article: "un", offerLabel: "Rooms", offerPage: "rooms", bookingLabel: "Check availability", bookingDetailLabel: "Guests", ctaFallback: "Check availability",
    highlights: [
      { title: "Comfortable rooms", text: "Quiet, clean and thoughtfully furnished." },
      { title: "Great location", text: "Close to what you came to see." },
      { title: "Personal service", text: "A small team that takes care of you." },
    ],
    services: [
      { name: "Double room", description: "A comfortable room for two." },
      { name: "Twin room", description: "Two single beds, ideal for friends or colleagues." },
      { name: "Family room", description: "Space for the whole family." },
    ],
    faq: [
      { q: "What time is check-in?", a: "Contact us and we'll confirm check-in and check-out times for your stay." },
      { q: "Is breakfast included?", a: "Ask us when you enquire — we'll tell you what's included with your room." },
    ],
  },
  barber: {
    label: "Barber", article: "a", offerLabel: "Services", offerPage: "services", bookingLabel: "Book an appointment", bookingDetailLabel: "Service", ctaFallback: "Book now",
    highlights: [
      { title: "Sharp cuts", text: "Classic and modern styles, done properly." },
      { title: "Hot towel shaves", text: "The full treatment." },
      { title: "No rush", text: "We take the time to get it right." },
    ],
    services: [
      { name: "Haircut", description: "Consultation, cut and style." },
      { name: "Beard trim", description: "Shape-up and tidy." },
      { name: "Cut & beard", description: "The complete look." },
    ],
    faq: [
      { q: "How do I book an appointment?", a: "Use the booking form or call us. We'll confirm your slot as soon as possible." },
      { q: "What if I need to cancel?", a: "Please let us know as early as you can so we can offer the slot to someone else." },
    ],
  },
  salon: {
    label: "Salon", article: "a", offerLabel: "Treatments", offerPage: "treatments", bookingLabel: "Book an appointment", bookingDetailLabel: "Treatment", ctaFallback: "Book now",
    highlights: [
      { title: "Expert team", text: "Experienced stylists who listen." },
      { title: "Quality products", text: "Professional care for your hair and skin." },
      { title: "Relaxed space", text: "Take a moment for yourself." },
    ],
    services: [
      { name: "Cut & style", description: "Tailored to you." },
      { name: "Colour", description: "From subtle refresh to full transformation." },
      { name: "Treatments", description: "Care and repair." },
    ],
    faq: [
      { q: "How do I book an appointment?", a: "Use the booking form or call us. We'll confirm your slot as soon as possible." },
      { q: "What if I need to cancel?", a: "Please let us know as early as you can so we can offer the slot to someone else." },
    ],
  },
  gym: {
    label: "Gym", article: "a", offerLabel: "Memberships & classes", offerPage: "memberships", bookingLabel: "Book a free trial", bookingDetailLabel: "Interest", ctaFallback: "Start your trial",
    highlights: [
      { title: "Train your way", text: "Equipment and space for strength, cardio and everything between." },
      { title: "Classes", text: "Group sessions to keep you motivated." },
      { title: "Coaching", text: "Support from people who know what they're doing." },
    ],
    services: [
      { name: "Monthly membership", description: "Full access to the gym floor." },
      { name: "Classes", description: "Group training sessions throughout the week." },
      { name: "Personal training", description: "One-to-one coaching." },
    ],
    faq: [{ q: "Can I try before I join?", a: "Yes — request a trial session and we'll show you around." }],
  },
  clothing: {
    label: "Clothing store", article: "a", offerLabel: "Collections", offerPage: "shop", bookingLabel: null, bookingDetailLabel: "Item", ctaFallback: "Shop the collection",
    highlights: [
      { title: "Curated pieces", text: "Chosen with care, made to last." },
      { title: "Personal styling", text: "Come in and we'll help you find your fit." },
      { title: "New arrivals", text: "Fresh pieces every season." },
    ],
    services: [
      { name: "Women", description: "Everyday essentials and statement pieces." },
      { name: "Men", description: "Modern classics." },
      { name: "Accessories", description: "The finishing touches." },
    ],
    faq: [{ q: "Do you offer returns?", a: "Ask in store or contact us about our returns policy." }],
  },
  dental: {
    label: "Dental clinic", article: "a", offerLabel: "Treatments", offerPage: "treatments", bookingLabel: "Request an appointment", bookingDetailLabel: "Reason for visit", ctaFallback: "Request an appointment",
    highlights: [
      { title: "Gentle care", text: "We put your comfort first." },
      { title: "Modern dentistry", text: "Up-to-date techniques and equipment." },
      { title: "For the whole family", text: "Care for patients of every age." },
    ],
    services: [
      { name: "Check-ups & hygiene", description: "Regular care to keep your smile healthy." },
      { name: "Restorative treatments", description: "Fillings, crowns and more." },
      { name: "Cosmetic dentistry", description: "Whitening and smile improvements." },
    ],
    faq: [
      { q: "Are you accepting new patients?", a: "Contact us and we'll let you know about availability." },
      { q: "What should I do in an emergency?", a: "Call us as soon as possible and we'll advise you on next steps." },
    ],
  },
  real_estate: {
    label: "Real estate agency", article: "a", offerLabel: "Services", offerPage: "services", bookingLabel: "Book a valuation", bookingDetailLabel: "Property", ctaFallback: "Book a free valuation",
    highlights: [
      { title: "Local knowledge", text: "We know the area and its market." },
      { title: "Honest advice", text: "Clear guidance from first viewing to completion." },
      { title: "Buyers & sellers", text: "Support on both sides of the move." },
    ],
    services: [
      { name: "Sales", description: "Marketing your property to the right buyers." },
      { name: "Rentals", description: "Finding reliable tenants." },
      { name: "Valuations", description: "An informed view of what your property is worth." },
    ],
    faq: [{ q: "How much is my property worth?", a: "Request a valuation and we'll give you an informed estimate." }],
  },
  manufacturer: {
    label: "Manufacturer", article: "a", offerLabel: "Products & services", offerPage: "products", bookingLabel: "Request a quote", bookingDetailLabel: "What you need (type, size)", ctaFallback: "Request a quote",
    highlights: [
      { title: "Made to order", text: "Tell us what you need and we'll quote it." },
      { title: "Repairs", text: "We also fix and restore existing work." },
      { title: "Straight answers", text: "Clear quotes and realistic delivery times." },
    ],
    services: [
      { name: "Manufacturing", description: "Built to your requirements." },
      { name: "Repairs", description: "Assessment and repair of existing pieces." },
    ],
    faq: [{ q: "How do I get a quote?", a: "Send us what you need — type, measurements and photos if you have them — and we'll reply with a quote." }],
  },
  other: {
    label: "Local business", article: "a", offerLabel: "Services", offerPage: "services", bookingLabel: null, bookingDetailLabel: "Subject", ctaFallback: "Get in touch",
    highlights: [
      { title: "Local", text: "Part of the neighbourhood." },
      { title: "Personal", text: "Real people who care about their work." },
      { title: "Reliable", text: "We do what we say." },
    ],
    services: [{ name: "Our services", description: "Get in touch to find out how we can help." }],
    faq: [{ q: "How can I contact you?", a: "Use the contact details on this page." }],
  },
};

const esIndustry: Record<Industry, IndustryText> = {
  restaurant: {
    label: "Restaurante", article: "un", offerLabel: "Menú", offerPage: "menu", bookingLabel: "Reserva tu mesa", bookingDetailLabel: "Personas", ctaFallback: "Reservar mesa",
    highlights: [
      { title: "Cocina de casa", text: "Platos hechos con cariño, como se comen en familia." },
      { title: "Para quedarse", text: "Buena atención, buen ambiente y sin apuro." },
      { title: "Para celebrar", text: "Desde un almuerzo entre semana hasta una reunión con los panas." },
    ],
    services: [
      { name: "Entradas", description: "Para abrir el apetito y compartir." },
      { name: "Platos principales", description: "Nuestras especialidades, preparadas al momento." },
      { name: "Postres", description: "El cierre dulce." },
    ],
    faq: [
      { q: "¿Necesito reservar?", a: "Siempre eres bienvenido, pero reservando aseguras tu mesa, sobre todo los fines de semana." },
      { q: "¿Tienen opciones para alergias o dietas especiales?", a: "Cuéntanos al reservar y haremos lo posible por atenderte." },
    ],
  },
  cafe: {
    label: "Cafetería", article: "una", offerLabel: "Menú", offerPage: "menu", bookingLabel: null, bookingDetailLabel: "Personas", ctaFallback: "Ver el menú",
    highlights: [
      { title: "Buen café", text: "Preparado con cuidado, taza por taza." },
      { title: "Horneado del día", text: "Pastelitos y dulces frescos desde temprano." },
      { title: "Quédate un rato", text: "Un lugar tranquilo para conversar, trabajar o descansar." },
    ],
    services: [
      { name: "Café y bebidas", description: "Guayoyo, marrón, con leche y más." },
      { name: "Desayunos", description: "Para empezar bien el día." },
      { name: "Dulces y tortas", description: "Frescos y hechos aquí." },
    ],
    faq: [{ q: "¿Tienen dónde sentarse?", a: "Sí, pasa y ponte cómodo." }],
  },
  bar: {
    label: "Bar", article: "un", offerLabel: "Bebidas", offerPage: "bebidas", bookingLabel: "Reserva una mesa", bookingDetailLabel: "Personas", ctaFallback: "Reservar mesa",
    highlights: [
      { title: "Tragos bien hechos", text: "Clásicos de siempre y creaciones de la casa." },
      { title: "Buen ambiente", text: "Buena música, buena gente, buenas noches." },
      { title: "Eventos privados", text: "Pregúntanos por tu próxima celebración." },
    ],
    services: [
      { name: "Cócteles", description: "Clásicos y especialidades de la casa." },
      { name: "Cervezas y vinos", description: "Bien fríos y bien escogidos." },
      { name: "Pasapalos", description: "Para picar y compartir." },
    ],
    faq: [{ q: "¿Puedo reservar para un grupo?", a: "Sí, envíanos tu solicitud con la fecha y cuántas personas son." }],
  },
  hotel: {
    label: "Hotel", article: "un", offerLabel: "Habitaciones", offerPage: "habitaciones", bookingLabel: "Consultar disponibilidad", bookingDetailLabel: "Huéspedes", ctaFallback: "Consultar disponibilidad",
    highlights: [
      { title: "Habitaciones cómodas", text: "Tranquilas, limpias y bien equipadas." },
      { title: "Buena ubicación", text: "Cerca de lo que viniste a conocer." },
      { title: "Atención personal", text: "Un equipo pequeño que te atiende de verdad." },
    ],
    services: [
      { name: "Habitación doble", description: "Cómoda para dos personas." },
      { name: "Habitación con dos camas", description: "Ideal para amigos o compañeros de viaje." },
      { name: "Habitación familiar", description: "Espacio para toda la familia." },
    ],
    faq: [
      { q: "¿A qué hora es el check-in?", a: "Escríbenos y te confirmamos los horarios de entrada y salida." },
      { q: "¿El desayuno está incluido?", a: "Pregúntanos al consultar y te diremos qué incluye tu habitación." },
    ],
  },
  barber: {
    label: "Barbería", article: "una", offerLabel: "Servicios", offerPage: "servicios", bookingLabel: "Reserva tu cita", bookingDetailLabel: "Servicio", ctaFallback: "Reservar cita",
    highlights: [
      { title: "Cortes con precisión", text: "Estilos clásicos y modernos, bien hechos." },
      { title: "Afeitado con toalla caliente", text: "El tratamiento completo." },
      { title: "Sin apuro", text: "Nos tomamos el tiempo de hacerlo bien." },
    ],
    services: [
      { name: "Corte de cabello", description: "Asesoría, corte y peinado." },
      { name: "Arreglo de barba", description: "Perfilado y retoque." },
      { name: "Corte y barba", description: "El look completo." },
    ],
    faq: [
      { q: "¿Cómo reservo una cita?", a: "Envíanos tu solicitud por WhatsApp desde esta página o llámanos. Te confirmamos lo antes posible." },
      { q: "¿Y si necesito cancelar?", a: "Avísanos con tiempo para poder darle el puesto a otra persona." },
    ],
  },
  salon: {
    label: "Peluquería", article: "una", offerLabel: "Servicios", offerPage: "servicios", bookingLabel: "Reserva tu cita", bookingDetailLabel: "Servicio", ctaFallback: "Reservar cita",
    highlights: [
      { title: "Equipo con experiencia", text: "Estilistas que te escuchan." },
      { title: "Productos de calidad", text: "Cuidado profesional para tu cabello y tu piel." },
      { title: "Un espacio para ti", text: "Tómate un momento para consentirte." },
    ],
    services: [
      { name: "Corte y peinado", description: "A tu medida." },
      { name: "Color", description: "Desde un retoque sutil hasta un cambio total." },
      { name: "Tratamientos", description: "Hidratación y reparación." },
    ],
    faq: [
      { q: "¿Cómo reservo una cita?", a: "Envíanos tu solicitud por WhatsApp desde esta página o llámanos. Te confirmamos lo antes posible." },
      { q: "¿Y si necesito cancelar?", a: "Avísanos con tiempo para poder darle el puesto a otra persona." },
    ],
  },
  gym: {
    label: "Gimnasio", article: "un", offerLabel: "Planes y clases", offerPage: "planes", bookingLabel: "Pide tu clase de prueba", bookingDetailLabel: "Te interesa", ctaFallback: "Probar gratis",
    highlights: [
      { title: "Entrena a tu manera", text: "Equipos y espacio para fuerza, cardio y todo lo demás." },
      { title: "Clases grupales", text: "Para mantenerte motivado." },
      { title: "Entrenadores", text: "Apoyo de gente que sabe lo que hace." },
    ],
    services: [
      { name: "Plan mensual", description: "Acceso completo al gimnasio." },
      { name: "Clases", description: "Sesiones grupales durante la semana." },
      { name: "Entrenamiento personal", description: "Acompañamiento uno a uno." },
    ],
    faq: [{ q: "¿Puedo probar antes de inscribirme?", a: "Sí, pide una clase de prueba y te mostramos todo." }],
  },
  clothing: {
    label: "Tienda de ropa", article: "una", offerLabel: "Colecciones", offerPage: "tienda", bookingLabel: null, bookingDetailLabel: "Producto", ctaFallback: "Ver la colección",
    highlights: [
      { title: "Piezas escogidas", text: "Seleccionadas con cuidado, hechas para durar." },
      { title: "Asesoría personal", text: "Ven y te ayudamos a encontrar tu talla y tu estilo." },
      { title: "Lo nuevo", text: "Mercancía nueva cada temporada." },
    ],
    services: [
      { name: "Damas", description: "Básicos y piezas que destacan." },
      { name: "Caballeros", description: "Clásicos modernos." },
      { name: "Accesorios", description: "El toque final." },
    ],
    faq: [
      { q: "¿Hacen envíos?", a: "Escríbenos por WhatsApp y te contamos las opciones de envío y delivery." },
      { q: "¿Qué métodos de pago aceptan?", a: "Pregúntanos y te indicamos los métodos disponibles." },
    ],
  },
  dental: {
    label: "Consultorio odontológico", article: "un", offerLabel: "Tratamientos", offerPage: "tratamientos", bookingLabel: "Solicita tu cita", bookingDetailLabel: "Motivo de la consulta", ctaFallback: "Solicitar cita",
    highlights: [
      { title: "Atención cuidadosa", text: "Tu comodidad es lo primero." },
      { title: "Odontología moderna", text: "Técnicas y equipos actualizados." },
      { title: "Para toda la familia", text: "Atención para pacientes de todas las edades." },
    ],
    services: [
      { name: "Consulta y limpieza", description: "Control regular para mantener tu sonrisa sana." },
      { name: "Tratamientos restaurativos", description: "Obturaciones, coronas y más." },
      { name: "Estética dental", description: "Blanqueamiento y mejoras de tu sonrisa." },
    ],
    faq: [
      { q: "¿Atienden pacientes nuevos?", a: "Escríbenos y te informamos la disponibilidad." },
      { q: "¿Qué hago en una emergencia?", a: "Llámanos lo antes posible y te orientamos." },
    ],
  },
  real_estate: {
    label: "Inmobiliaria", article: "una", offerLabel: "Servicios", offerPage: "servicios", bookingLabel: "Solicita un avalúo", bookingDetailLabel: "Inmueble", ctaFallback: "Solicitar avalúo",
    highlights: [
      { title: "Conocemos la zona", text: "Sabemos cómo se mueve el mercado local." },
      { title: "Asesoría honesta", text: "Te acompañamos de la primera visita a la firma." },
      { title: "Compra y venta", text: "Apoyo para compradores y vendedores." },
    ],
    services: [
      { name: "Venta", description: "Promocionamos tu inmueble ante los compradores adecuados." },
      { name: "Alquiler", description: "Encontramos inquilinos confiables." },
      { name: "Avalúos", description: "Una estimación informada del valor de tu inmueble." },
    ],
    faq: [{ q: "¿Cuánto vale mi inmueble?", a: "Solicita un avalúo y te damos una estimación informada." }],
  },
  manufacturer: {
    label: "Fábrica", article: "una", offerLabel: "Productos y servicios", offerPage: "productos", bookingLabel: "Solicita tu cotización", bookingDetailLabel: "Qué necesitas (tipo, medidas)", ctaFallback: "Solicitar cotización",
    highlights: [
      { title: "Hecho a la medida", text: "Cuéntanos qué necesitas y te enviamos una cotización." },
      { title: "Reparaciones", text: "También reparamos y recuperamos trabajos existentes." },
      { title: "Respuestas claras", text: "Cotizaciones claras y tiempos de entrega realistas." },
    ],
    services: [
      { name: "Fabricación", description: "Hecho según tus requerimientos." },
      { name: "Reparación", description: "Evaluación y reparación de piezas existentes." },
    ],
    faq: [{ q: "¿Cómo pido una cotización?", a: "Envíanos lo que necesitas —tipo, medidas y fotos si las tienes— y te respondemos con una cotización." }],
  },
  other: {
    label: "Negocio local", article: "un", offerLabel: "Servicios", offerPage: "servicios", bookingLabel: null, bookingDetailLabel: "Asunto", ctaFallback: "Contáctanos",
    highlights: [
      { title: "Cercanos", text: "Parte de la comunidad." },
      { title: "Personales", text: "Gente real que cuida su trabajo." },
      { title: "Confiables", text: "Cumplimos lo que decimos." },
    ],
    services: [{ name: "Nuestros servicios", description: "Escríbenos y te contamos cómo podemos ayudarte." }],
    faq: [{ q: "¿Cómo los contacto?", a: "Usa los datos de contacto de esta página." }],
  },
};

export const INDUSTRY_TEXT: Record<Locale, Record<Industry, IndustryText>> = { es: esIndustry, en: enIndustry };

const OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Human-readable opening hours. Understands the OpenStreetMap format
 * ("Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off"); anything else is shown as-is.
 */
export function formatOpeningHours(raw: string, locale: Locale): string[] {
  const t = UI[locale];
  if (raw.trim() === "24/7") return [t.allDay];
  return raw
    .split(/\s*;\s*/)
    .filter(Boolean)
    .map((rule) => {
      let out = rule.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => t.days[OSM_DAYS.indexOf(d)]!);
      out = out.replace(/\bPH\b/g, t.holidays).replace(/\b(off|closed)\b/gi, t.closed);
      out = out.replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g, "$1–$2").replace(/([A-Za-zÀ-ÿ]+)-([A-Za-zÀ-ÿ]+)/g, "$1–$2");
      return out.replace(/,(?=\S)/g, ", ");
    });
}
