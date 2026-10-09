import Image from "next/image";
import { Header } from "@/components/Header";
import { LeadForm } from "@/components/LeadForm";
import {
  company,
  faq,
  listings,
  nav,
  perks,
  places,
  reviews,
  services,
  stats,
  steps,
} from "@/lib/content";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: company.name,
  telephone: company.phone,
  email: company.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: company.address,
    addressRegion: company.region,
    addressCountry: "KG",
  },
  openingHours: "Mo-Su 09:00-20:00",
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main>
        <section className="hero pad">
          <div className="hero-text">
            <span className="badge">{company.tagline}</span>
            <h1>
              Дом на берегу Иссык-Куля — <em>как дома</em>
            </h1>
            <p className="lead">
              Аалам Хаус подбирает и сдаёт в аренду квартиры, дома, коттеджи и гостевые дома.
              Основное направление — Иссык-Куль, но работаем в Бишкеке, Оше, Караколе, Нарыне и
              других городах страны.
            </p>
            <div className="actions">
              <a href="#contacts" className="btn btn-primary">
                Подобрать жильё
              </a>
              <a href="#services" className="btn btn-secondary">
                Наши услуги
              </a>
            </div>
          </div>
          <div className="hero-media">
            <div className="hero-shadow" aria-hidden />
            <Image
              src="/hero-cottage.jpg"
              alt="Деревянный коттедж на берегу горного озера"
              width={1600}
              height={2400}
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </div>
        </section>

        <section className="stats pad" aria-label="Цифры">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </section>

        <section id="services" className="section bg-sand pad">
          <h2>Что мы предлагаем</h2>
          <p className="sub">Подберём жильё под ваш бюджет, даты и состав семьи.</p>
          <div className="grid grid-260">
            {services.map((s) => (
              <article key={s.title} className={`tile tone-${s.tone}`}>
                <div className="kicker">{s.kicker}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="listings" className="section pad">
          <h2>Популярные объекты</h2>
          <p className="sub">Несколько вариантов из базы. Полную подборку пришлём под ваш запрос.</p>
          <div className="grid grid-300">
            {listings.map((l) => (
              <article key={l.title} className="listing">
                <div className={`listing-photo tone-${l.tone}`}>
                  <span>{l.type}</span>
                </div>
                <div className="listing-body">
                  <h3>{l.title}</h3>
                  <div className="muted">{l.place}</div>
                  <div className="muted">{l.guests}</div>
                  <ul className="chips">
                    {l.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <div className="listing-foot">
                    <div>
                      <b>{l.price}</b> <span className="muted">/ {l.unit}</span>
                    </div>
                    <a href="#contacts">Забронировать</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="places" className="section pad">
          <h2>Направления</h2>
          <p className="sub">
            Главное — Иссык-Куль, у озера и в глубине побережья. Остальные города — по запросу.
          </p>
          <div className="grid grid-300 wide-gap">
            {places.map((p) => (
              <div key={p.kicker}>
                <div className="kicker" style={{ color: p.color }}>
                  {p.kicker}
                </div>
                <div className="place-title">{p.title}</div>
                <p className="muted">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="section bg-sage pad">
          <div className="grid grid-360 wide-gap">
            <h2>О компании</h2>
            <div className="about-text">
              <p>
                «Аалам» по-кыргызски — мир. Мы хотим, чтобы у каждого гостя и жителя был свой
                уютный мир: чистый, тёплый и без сюрпризов.
              </p>
              <p>
                Мы сами осматриваем каждый объект, фотографируем его как есть и называем честную
                цену. Владельцам берём на себя поиск арендаторов, заселение и контроль состояния
                жилья.
              </p>
              <div className="grid grid-200 perks">
                {perks.map((p) => (
                  <div key={p.title} className="perk">
                    <b>{p.title}</b>
                    <span>{p.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="section pad">
          <h2>Как мы работаем</h2>
          <ol className="grid grid-230 steps">
            {steps.map((s) => (
              <li key={s.n}>
                <div className="step-n">{s.n}</div>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section bg-sand pad" aria-labelledby="reviews-title">
          <h2 id="reviews-title">Отзывы гостей</h2>
          <div className="grid grid-300">
            {reviews.map((r) => (
              <figure key={r.name} className="review">
                <blockquote>«{r.text}»</blockquote>
                <figcaption>
                  <b>{r.name}</b>
                  <span className="muted">{r.stay}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section bg-rose pad" aria-labelledby="faq-title">
          <h2 id="faq-title">Вопросы, которые задают чаще всего</h2>
          <div className="faq">
            {faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contacts" className="section pad">
          <div className="grid grid-360 wide-gap">
            <div>
              <h2>Контакты</h2>
              <p className="sub">Оставьте заявку или позвоните — ответим в течение часа.</p>
              <dl className="contacts">
                <div>
                  <dt>Телефон / WhatsApp</dt>
                  <dd>
                    <a href={company.phoneHref}>{company.phone}</a>
                  </dd>
                </div>
                <div>
                  <dt>Почта</dt>
                  <dd>
                    <a href={`mailto:${company.email}`}>{company.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>Офис</dt>
                  <dd>
                    {company.address}
                    <br />
                    {company.hours}
                  </dd>
                </div>
                <div>
                  <dt>Соцсети</dt>
                  <dd className="socials">
                    <a href={company.instagram} target="_blank" rel="noopener">Instagram</a>
                    <a href={company.telegram} target="_blank" rel="noopener">Telegram</a>
                    <a href={company.whatsapp} target="_blank" rel="noopener">WhatsApp</a>
                  </dd>
                </div>
              </dl>
              <iframe
                className="map"
                title="Офис на карте"
                src={company.mapEmbed}
                loading="lazy"
              />
              <a href={company.mapLink} target="_blank" rel="noopener" className="small">
                Открыть карту крупнее
              </a>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>

      <footer className="footer pad">
        <div>
          <b className="footer-brand">{company.name}</b>
          <div>{company.tagline}</div>
          <div className="small">{company.inn}</div>
        </div>
        <nav className="footer-nav" aria-label="Разделы">
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="footer-contacts">
          <a href={company.phoneHref}>{company.phone}</a>
          <a href={`mailto:${company.email}`}>{company.email}</a>
          <div className="small">© 2026 {company.name}. Все права защищены.</div>
        </div>
      </footer>

      <a
        href={company.whatsapp}
        target="_blank"
        rel="noopener"
        className="wa-float"
        aria-label="Написать в WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"
          />
        </svg>
      </a>
    </>
  );
}
