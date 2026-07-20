import type { Metadata } from "next";
import Image from "next/image";
import { siteConfig } from "../lib/site-config";
import commewijnePort from "../public/landing/commewijne-port-facility.png";
import consultingDesign from "../public/landing/consulting-design.jpg";
import heroResidence from "../public/landing/hero-residence.jpg";
import kwattawegResidence from "../public/landing/kwattaweg-residence.png";
import newmontRecreation from "../public/landing/newmont-recreation-centre.jpg";
import residenceLalta from "../public/landing/residence-lalta.jpg";
import residentialStructural from "../public/landing/residential-structural-design.jpg";
import samaraApartment from "../public/landing/samara-apartment-complex.jpg";
import structuralFrame from "../public/landing/structural-frame.jpg";
import { LandingNavigation } from "./landing-navigation";
import { LandingMotion } from "./landing-motion";

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_SR",
    alternateLocale: ["nl_SR"],
    siteName: siteConfig.name,
    url: "/",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [{
      url: "/landing/hero-residence.jpg",
      width: 2560,
      height: 1440,
      alt: "Architectural design and engineering by CODECO N.V. in Suriname",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/landing/hero-residence.jpg"],
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["ProfessionalService", "Organization"],
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      legalName: siteConfig.legalName,
      url: `${siteConfig.url}/`,
      logo: `${siteConfig.url}/codeco-logo.png`,
      image: `${siteConfig.url}/landing/hero-residence.jpg`,
      description: siteConfig.description,
      foundingDate: "2015",
      email: siteConfig.email,
      telephone: siteConfig.telephone,
      address: {
        "@type": "PostalAddress",
        ...siteConfig.address,
      },
      areaServed: {
        "@type": "Country",
        name: "Suriname",
      },
      knowsAbout: [
        "Architectuur",
        "Civiele techniek",
        "Constructieve engineering",
        "Bouwadvies",
        "Projectmanagement",
        "Constructiesupervisie",
      ],
      sameAs: [siteConfig.facebook],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Engineering- en bouwdiensten",
        itemListElement: [
          "Architectural design",
          "Civil and structural engineering",
          "Project management and construction supervision",
          "Tendering and contracting support",
          "Technical consulting",
        ].map((name) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name },
        })),
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      url: `${siteConfig.url}/`,
      name: siteConfig.name,
      inLanguage: "en-SR",
      publisher: { "@id": `${siteConfig.url}/#organization` },
    },
  ],
};

const projects = [
  {
    number: "01",
    title: "Newmont Recreation Centre",
    category: "Building · Construction",
    image: newmontRecreation,
    className: "studio-project-wide",
  },
  {
    number: "02",
    title: "Samara Apartment Complex",
    category: "Building · Construction",
    image: samaraApartment,
    className: "",
  },
  {
    number: "03",
    title: "Kwattaweg Residence",
    category: "Structural design",
    image: kwattawegResidence,
    className: "studio-project-technical",
  },
  {
    number: "04",
    title: "Commewijne Port Facility",
    category: "Infrastructure · Engineering",
    image: commewijnePort,
    className: "studio-project-wide studio-project-drawing",
  },
  {
    number: "05",
    title: "Residence Building Lalta",
    category: "Building · Design",
    image: residenceLalta,
    className: "",
  },
  {
    number: "06",
    title: "Residential Structural Design",
    category: "Structural engineering",
    image: residentialStructural,
    className: "studio-project-technical",
  },
];

const services = [
  {
    number: "01",
    title: "Engineering",
    description:
      "Architectural designs, structural analysis, foundations, construction budgets and infrastructure—from roads and drainage to bridges and hydraulic works.",
    detail: "Design · Calculation · Documentation",
  },
  {
    number: "02",
    title: "Contracting",
    description:
      "Complete tender guidance, objective technical and financial assessment, and support with contract formats for clients and contractors.",
    detail: "Tendering · Analysis · Contracts",
  },
  {
    number: "03",
    title: "Project management",
    description:
      "Permanent on-site supervision, project-specific quality checks, budget and deadline control, and transparent daily and weekly reporting.",
    detail: "Supervision · Quality · Reporting",
  },
  {
    number: "04",
    title: "Consulting",
    description:
      "Independent advice across design, engineering and construction, including budget reviews, tender assessments and checks of existing building plans.",
    detail: "Advice · Review · Assurance",
  },
];

const clients = [
  "Architect.sr",
  "IDB",
  "Newmont",
  "SOL Suriname",
  "VCB Bank",
  "Cirkel Group",
  "Rudisa",
  "Protrade International",
  "Superior Tanks & Piping",
  "North Metal Working",
];

export default function Home() {
  return (
    <main className="studio" id="top">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <a className="studio-skip-link" href="#main-content">Skip to content</a>
      <LandingNavigation />
      <LandingMotion />

      <div id="main-content">
        <header className="studio-hero" aria-labelledby="hero-title">
          <div className="studio-hero-aperture" aria-hidden="true"><span /><span /><i /></div>
          <div className="studio-hero-media" aria-hidden="true">
            <Image
              className="studio-hero-frame studio-hero-frame-one"
              src={heroResidence}
              alt=""
              fill
              priority
              placeholder="blur"
              quality={82}
              sizes="100vw"
            />
            <Image
              className="studio-hero-frame studio-hero-frame-two"
              src={newmontRecreation}
              alt=""
              fill
              priority
              placeholder="blur"
              quality={82}
              sizes="100vw"
            />
          </div>
          <div className="studio-hero-scrim" />
          <div className="studio-grid-lines" aria-hidden="true"><span /><span /><span /></div>

          <div className="studio-wrap studio-hero-content">
            <p className="studio-kicker">Architecture · Engineering · Paramaribo, Suriname</p>
            <h1 id="hero-title">
              <span className="studio-hero-line"><span>Architecture &amp; engineering</span></span>
              <span className="studio-hero-line"><span><em>built for Suriname.</em></span></span>
            </h1>
            <p className="studio-hero-copy">
              CODECO N.V. brings architectural design, civil and structural engineering, project management and technical advice together for work that is clear, buildable and made to last.
            </p>
            <div className="studio-actions">
              <a className="studio-btn studio-btn-light" href="#work">View selected work <i className="studio-icon-arrow" aria-hidden="true" /></a>
              <a className="studio-btn studio-btn-ghost" href="mailto:info@codeconv.com">Start a project</a>
            </div>
          </div>

          <aside className="studio-hero-facts" aria-label="CODECO company facts">
            <span>Based in</span><strong>Paramaribo, Suriname</strong>
            <span>Established</span><strong>2015</strong>
          </aside>
          <div className="studio-hero-index" aria-hidden="true">
            <span>CODECO / SR</span><strong>01</strong><i />
          </div>
          <a className="studio-scroll-cue" href="#work"><span>Scroll to explore</span><i aria-hidden="true" /></a>
        </header>

        <div className="studio-marquee" aria-label="CODECO disciplines">
          <div className="studio-marquee-track">
            {[0, 1].map((copy) => (
              <div aria-hidden={copy === 1} key={copy}>
                <span>Engineering</span><i>—</i><span>Structural design</span><i>—</i>
                <span>Project management</span><i>—</i><span>Contracting</span><i>—</i>
                <span>Consulting</span><i>—</i><span>Infrastructure</span><i>—</i>
              </div>
            ))}
          </div>
        </div>

        <section className="studio-section studio-work" id="work" aria-labelledby="work-title">
          <div className="studio-wrap">
            <div className="studio-section-head" data-reveal="rise">
              <div>
                <p className="studio-label">Selected work</p>
                <h2 id="work-title">Ideas tested.<br /><strong>Structures resolved.</strong></h2>
              </div>
              <p>Architecture, structural systems and infrastructure developed by CODECO in Suriname.</p>
            </div>

            <div className="studio-project-grid">
              {projects.map((project) => (
                <article className={`studio-project ${project.className}`} data-reveal="project" key={project.number}>
                  <div className="studio-project-image">
                    <Image
                      src={project.image}
                      alt={project.title}
                      fill
                      placeholder="blur"
                      quality={78}
                      sizes={project.className.includes("wide") ? "100vw" : "(max-width: 760px) 86vw, 50vw"}
                    />
                    <span className="studio-project-number">{project.number} / 06</span>
                    <div className="studio-project-overlay"><span>CODECO project</span></div>
                  </div>
                  <div className="studio-project-copy">
                    <h3>{project.title}</h3>
                    <p>{project.category}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="studio-swipe-note">Swipe to explore projects <i className="studio-icon-arrow" aria-hidden="true" /></p>
          </div>
        </section>

        <section className="studio-section studio-story" id="about" aria-labelledby="about-title">
          <div className="studio-wrap">
            <div className="studio-story-grid">
              <div className="studio-story-image" data-reveal="image">
                <Image
                  src={structuralFrame}
                  alt="Structural frame designed and analysed by CODECO"
                  fill
                  loading="eager"
                  fetchPriority="low"
                  placeholder="blur"
                  quality={78}
                  sizes="(max-width: 820px) 100vw, 54vw"
                />
                <div className="studio-story-stamp" aria-hidden="true"><span>Structural analysis</span><strong>01 / 04</strong></div>
                <span>Analysis before execution</span>
              </div>
              <div className="studio-story-copy" data-reveal="rise">
                <p className="studio-label">About CODECO</p>
                <h2 id="about-title">One team for the thinking <strong>behind the build.</strong></h2>
                <p>
                  CODECO is an architecture and engineering company in Paramaribo, Suriname, specialising in building design, civil and structural engineering and related services. Our engineers shape efficient solutions around each client’s needs, budget and schedule.
                </p>
                <p>
                  From residential buildings to warehouses, docks and filling sheds for multinational companies, every project is approached with technical discipline and practical judgement.
                </p>
                <a className="studio-text-link" href="#services">Explore our capabilities <i className="studio-icon-arrow studio-icon-arrow-down" aria-hidden="true" /></a>
              </div>
            </div>

            <div className="studio-fact-row">
              <div data-reveal="rise"><strong>2015</strong><span>Established in Suriname</span></div>
              <div data-reveal="rise"><strong>04</strong><span>Integrated disciplines</span></div>
              <div data-reveal="rise"><strong>01</strong><span>Accountable project partner</span></div>
              <div data-reveal="rise"><strong>∞</strong><span>Built around client needs</span></div>
            </div>
          </div>
        </section>

        <section className="studio-section studio-services" id="services" aria-labelledby="services-title">
          <div className="studio-wrap">
            <div className="studio-section-head studio-services-head" data-reveal="rise">
              <div>
                <p className="studio-label">What we do</p>
                <h2 id="services-title">From early advice<br /><strong>to on-site control.</strong></h2>
              </div>
              <p>CODECO supports the full technical journey: design, selection, execution and independent assurance.</p>
            </div>

            <div className="studio-service-list">
              {services.map((service) => (
                <article className="studio-service" data-reveal="service" key={service.number}>
                  <span>{service.number}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <small>{service.detail}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="studio-values" aria-labelledby="values-title">
          <div className="studio-values-image">
            <Image src={consultingDesign} alt="Contemporary building design by CODECO" fill placeholder="blur" quality={78} sizes="100vw" />
          </div>
          <div className="studio-values-scrim" />
          <div className="studio-wrap studio-values-content" data-reveal="rise">
            <p className="studio-label">How we work</p>
            <h2 id="values-title">Quality is the standard.<br /><strong>Transparency is the process.</strong></h2>
            <div className="studio-value-list">
              <span>Quality</span><span>Transparency</span><span>Customer satisfaction</span><span>Commitment</span>
            </div>
          </div>
        </section>

        <section className="studio-clients" aria-labelledby="clients-title">
          <div className="studio-wrap" data-reveal="rise"><p className="studio-label" id="clients-title">Selected clients</p></div>
          <div className="studio-client-track">
            {[0, 1].map((copy) => (
              <div aria-hidden={copy === 1} key={copy}>
                {clients.map((client) => <span key={`${copy}-${client}`}>{client}</span>)}
              </div>
            ))}
          </div>
        </section>

        <section className="studio-contact" id="contact" aria-labelledby="contact-title">
          <div className="studio-wrap studio-contact-grid" data-reveal="rise">
            <div>
              <p className="studio-label">Start a project</p>
              <h2 id="contact-title">Have a plan in mind?<br /><strong>Let’s make it stand.</strong></h2>
            </div>
            <div className="studio-contact-actions">
              <a href="mailto:info@codeconv.com">info@codeconv.com <i className="studio-icon-arrow studio-icon-arrow-up" aria-hidden="true" /></a>
              <a href="tel:+5978554345">+597 855-4345 <i className="studio-icon-arrow studio-icon-arrow-up" aria-hidden="true" /></a>
            </div>
          </div>
        </section>
      </div>

      <footer className="studio-footer">
        <div className="studio-wrap">
          <div className="studio-footer-top" data-reveal="rise">
            <div className="studio-footer-brand">
              <Image src="/codeco-logo.png" alt="CODECO Construction Designers & Consultants N.V." width={738} height={291} />
              <p>Architecture and multidisciplinary engineering in Suriname for professional, quality-driven civil, structural and construction projects.</p>
            </div>
            <div className="studio-footer-column">
              <p>Office</p>
              <address>Kwattaweg 717E<br />Paramaribo, Suriname</address>
              <a href="tel:+5978554345">+597 855-4345</a>
              <a href="mailto:info@codeconv.com">info@codeconv.com</a>
            </div>
            <div className="studio-footer-column">
              <p>Expertise</p>
              <a href="#services">Engineering</a>
              <a href="#services">Contracting</a>
              <a href="#services">Project management</a>
              <a href="#services">Consulting</a>
            </div>
            <div className="studio-footer-column">
              <p>Company</p>
              <a href="#about">About CODECO</a>
              <a href="#work">Selected work</a>
              <a href="#contact">Contact</a>
              <a href="https://www.facebook.com/codeconv/" target="_blank" rel="noreferrer">Facebook <i className="studio-icon-arrow studio-icon-arrow-up" aria-hidden="true" /></a>
            </div>
          </div>
          <div className="studio-footer-bottom">
            <p>© {new Date().getFullYear()} CODECO N.V. · Construction Designers & Consultants N.V.</p>
            <p>Engineering · Contracting · Consulting</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
