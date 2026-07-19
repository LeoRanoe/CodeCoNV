import Image from "next/image";

const services = [
  {
    number: "01",
    title: "Engineering",
    description:
      "Architectural concepts, structural analysis, foundations, budgets and infrastructure design—developed to national and international standards.",
    scope: "Structures · Foundations · Roads & drainage · Bridges",
  },
  {
    number: "02",
    title: "Contracting",
    description:
      "Independent tender guidance, technical and financial comparison, and contract support from documentation through contractor selection.",
    scope: "Tender documents · Objective analysis · Contract formats",
  },
  {
    number: "03",
    title: "Project management",
    description:
      "On-site supervision, quality control, deadline and budget management, backed by clear daily and weekly reporting.",
    scope: "Supervision · Reporting · Budgets · Deadlines",
  },
  {
    number: "04",
    title: "Consulting",
    description:
      "Independent advice for clients and contractors across design, engineering, budgets, tenders and existing building plans.",
    scope: "Design advice · Budget review · Plan assessment",
  },
];

const projects = [
  {
    title: "Newmont Recreation Centre",
    type: "Building · Construction",
    image: "/landing/newmont-recreation-centre.jpg",
    className: "landing-project-featured",
  },
  {
    title: "Kwattaweg Residence",
    type: "Building · Structural design",
    image: "/landing/kwattaweg-residence.png",
    className: "landing-project-technical",
  },
  {
    title: "Samara Apartment Complex",
    type: "Building · Construction",
    image: "/landing/samara-apartment-complex.jpg",
    className: "landing-project-residential",
  },
];

const values = [
  ["01", "Quality", "Internationally recognised standards are embedded in every project."],
  ["02", "Transparency", "Clients stay informed and involved at every stage of the work."],
  ["03", "Customer satisfaction", "Each solution begins with the client’s real needs."],
  ["04", "Commitment", "We treat every project as our own and see the journey through."],
];

export default function Home() {
  return (
    <main className="landing" id="top">
      <a className="landing-skip-link" href="#content">Skip to content</a>

      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <a className="landing-logo" href="#top" aria-label="CODECO home">
            <Image
              src="/codeco-logo.png"
              alt="CODECO Construction Designers & Consultants N.V."
              width={738}
              height={291}
              priority
            />
          </a>

          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#expertise">Expertise</a>
            <a href="#work">Projects</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>

          <a className="landing-header-cta" href="mailto:info@codeconv.com">
            Discuss a project <span aria-hidden="true">↗</span>
          </a>

          <details className="landing-mobile-menu">
            <summary aria-label="Open navigation"><span /><span /></summary>
            <nav aria-label="Mobile navigation">
              <a href="#expertise">Expertise</a>
              <a href="#work">Projects</a>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </nav>
          </details>
        </div>
      </header>

      <div id="content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow">Civil · Structural · Construction</p>
              <h1 id="landing-title">Sound thinking.<br /><span>Solid structures.</span></h1>
              <p className="landing-hero-lead">
                CODECO N.V. is a multidisciplinary technical engineering firm in Paramaribo,
                delivering professional, quality-driven solutions for civil, structural and construction projects.
              </p>
              <div className="landing-hero-actions">
                <a className="landing-button landing-button-primary" href="mailto:info@codeconv.com">
                  Start a conversation <span aria-hidden="true">↗</span>
                </a>
                <a className="landing-text-link" href="#expertise">Explore our expertise <span aria-hidden="true">↓</span></a>
              </div>
              <dl className="landing-facts" aria-label="Company facts">
                <div><dt>Established</dt><dd>2015</dd></div>
                <div><dt>Based in</dt><dd>Paramaribo</dd></div>
                <div><dt>Working to</dt><dd>International standards</dd></div>
              </dl>
            </div>

            <div className="landing-hero-visual" aria-label="CODECO architectural and structural design work">
              <div className="landing-hero-image-main">
                <Image
                  src="/landing/hero-residence.jpg"
                  alt="Modern residence designed by CODECO"
                  fill
                  priority
                  sizes="(max-width: 880px) 100vw, 54vw"
                />
                <span className="landing-image-index">01 / Architectural design</span>
              </div>
              <div className="landing-hero-image-detail">
                <Image
                  src="/landing/structural-analysis.jpg"
                  alt="CODECO structural displacement analysis model"
                  fill
                  priority
                  sizes="(max-width: 880px) 42vw, 20vw"
                />
                <span>Structural analysis</span>
              </div>
              <span className="landing-hero-mark" aria-hidden="true">C</span>
            </div>
          </div>
        </section>

        <div className="landing-service-band" aria-label="Areas of expertise">
          <div className="landing-container">
            <span>Engineering</span><i aria-hidden="true" />
            <span>Contracting</span><i aria-hidden="true" />
            <span>Project management</span><i aria-hidden="true" />
            <span>Consulting</span>
          </div>
        </div>

        <section className="landing-section landing-about" id="about" aria-labelledby="about-title">
          <div className="landing-container landing-about-grid">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">About CODECO</p>
              <h2 id="about-title">Engineering decisions that stand up in the real world.</h2>
            </div>
            <div className="landing-about-copy">
              <p>
                Our engineers translate complex requirements into efficient, buildable solutions—within budget and schedule.
                The work ranges from residences and commercial buildings to warehouses, docks and filling sheds for multinational companies.
              </p>
              <p>
                We advise, coordinate, guide, develop and design. Every assignment begins with a careful understanding of the client’s needs
                and ends with clear, accountable delivery.
              </p>
              <a className="landing-inline-link" href="#values">How we work <span aria-hidden="true">→</span></a>
            </div>
            <figure className="landing-about-image">
              <Image
                src="/landing/consulting-design.jpg"
                alt="Contemporary commercial building designed by CODECO"
                fill
                sizes="(max-width: 760px) 100vw, 58vw"
              />
              <figcaption>Design, engineering and construction expertise in one team.</figcaption>
            </figure>
            <blockquote>
              <span aria-hidden="true">“</span>
              Reliable, professional and cost-effective solutions—locally and internationally.
            </blockquote>
          </div>
        </section>

        <section className="landing-section landing-expertise" id="expertise" aria-labelledby="expertise-title">
          <div className="landing-container">
            <div className="landing-section-topline">
              <div>
                <p className="landing-eyebrow">What we do</p>
                <h2 id="expertise-title">Four disciplines.<br />One clear standard.</h2>
              </div>
              <p>From the first sketch to final reporting, CODECO helps clients make informed decisions and keep work on course.</p>
            </div>
            <div className="landing-service-list">
              {services.map((service) => (
                <article className="landing-service-row" key={service.number}>
                  <span className="landing-service-number">{service.number}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <small>{service.scope}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-work" id="work" aria-labelledby="work-title">
          <div className="landing-container">
            <div className="landing-section-topline landing-work-heading">
              <div>
                <p className="landing-eyebrow">Selected work</p>
                <h2 id="work-title">Built on analysis.<br />Shaped around people.</h2>
              </div>
              <p>Featured engineering and design work from CODECO’s project portfolio.</p>
            </div>
            <div className="landing-project-grid">
              {projects.map((project, index) => (
                <article className={`landing-project ${project.className}`} key={project.title}>
                  <div className="landing-project-image">
                    <Image src={project.image} alt={project.title} fill sizes={index === 0 ? "(max-width: 760px) 100vw, 62vw" : "(max-width: 760px) 100vw, 38vw"} />
                  </div>
                  <div className="landing-project-meta">
                    <div><small>{project.type}</small><h3>{project.title}</h3></div>
                    <span aria-hidden="true">0{index + 1}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-values" id="values" aria-labelledby="values-title">
          <div className="landing-container landing-values-grid">
            <div className="landing-values-intro">
              <p className="landing-eyebrow">Core values</p>
              <h2 id="values-title">What the work<br />has to live up to.</h2>
              <p>Four principles guide the way CODECO works with every client, contractor and project team.</p>
            </div>
            <div className="landing-values-list">
              {values.map(([number, title, description]) => (
                <article key={number}>
                  <span>{number}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-clients" aria-labelledby="clients-title">
          <div className="landing-container">
            <p className="landing-eyebrow" id="clients-title">Trusted by</p>
            <div className="landing-client-list">
              <span>Architect.sr</span><span>IDB</span><span>Newmont</span><span>SOL Suriname</span>
              <span>VCB Bank</span><span>Cirkel Group</span><span>Rudisa</span><span>Protrade International</span>
            </div>
          </div>
        </section>

        <section className="landing-contact" id="contact" aria-labelledby="contact-title">
          <div className="landing-container landing-contact-grid">
            <div>
              <p className="landing-eyebrow">Start a project</p>
              <h2 id="contact-title">Bring us the challenge.<br />We’ll bring the structure.</h2>
            </div>
            <div className="landing-contact-details">
              <a href="mailto:info@codeconv.com">info@codeconv.com <span aria-hidden="true">↗</span></a>
              <a href="tel:+5978554345">+597 855-4345 <span aria-hidden="true">↗</span></a>
              <address>Kwattaweg 717E<br />Paramaribo, Suriname</address>
            </div>
          </div>
        </section>
      </div>

      <footer className="landing-footer">
        <div className="landing-container">
          <a className="landing-logo landing-footer-logo" href="#top" aria-label="CODECO home">
            <Image src="/codeco-logo.png" alt="CODECO Construction Designers & Consultants N.V." width={738} height={291} />
          </a>
          <p>Engineering · Contracting · Consulting</p>
          <p>© {new Date().getFullYear()} CODECO N.V.</p>
        </div>
      </footer>
    </main>
  );
}
