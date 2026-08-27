interface ImportExportCard {
  title: string
  description: string
  formats: string
  status: string
  statusClass: string
}

const IMPORT_CARDS: ImportExportCard[] = [
  {
    title: 'Database giocatori',
    description:
      'Importazione dell’anagrafica e dei dati correnti dei giocatori.',
    formats:
      'Excel / CSV / formato normalizzato',
    status:
      'Da collegare',
    statusClass:
      'pending',
  },

  {
    title: 'Dati storici',
    description:
      'Importazione delle stagioni precedenti e dei dati utili allo storico giocatore.',
    formats:
      'Excel / CSV',
    status:
      'Da collegare',
    statusClass:
      'pending',
  },
]

const EXPORT_CARDS: ImportExportCard[] = [
  {
    title: 'Dati storici',
    description:
      'Esportazione futura dello storico normalizzato di MisterCanà.',
    formats:
      'CSV / Excel / JSON',
    status:
      'Da collegare',
    statusClass:
      'pending',
  },
]

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderCard(
  card: ImportExportCard,
  direction:
    | 'import'
    | 'export',
): string {
  return `
    <article
      class="data-transfer-card"
    >

      <div
        class="data-transfer-card-header"
      >

        <div
          class="
            data-transfer-icon
            data-transfer-icon-${direction}
          "
        >
          ${
            direction === 'import'
              ? '↓'
              : '↑'
          }
        </div>

        <span
          class="
            data-transfer-status
            status-${card.statusClass}
          "
        >
          ${escapeHtml(
            card.status,
          )}
        </span>

      </div>

      <div
        class="data-transfer-card-body"
      >

        <h3>
          ${escapeHtml(
            card.title,
          )}
        </h3>

        <p>
          ${escapeHtml(
            card.description,
          )}
        </p>

      </div>

      <div
        class="data-transfer-card-footer"
      >

        <div>

          <span>
            Formati previsti
          </span>

          <strong>
            ${escapeHtml(
              card.formats,
            )}
          </strong>

        </div>

        <button
          type="button"
          class="data-transfer-button"
          disabled
        >
          Non ancora collegato
        </button>

      </div>

    </article>
  `
}

export function renderImportExportPage(): string {
  return `
    <section
      class="page import-export-page"
    >

      <div
        class="import-export-page-header"
      >

        <div>

          <h1>
            Import / Export
          </h1>

          <p>
            Gestione dei dati principali
            di MisterCanà.
          </p>

        </div>

      </div>

      <section
        class="data-transfer-section"
      >

        <div
          class="data-transfer-section-header"
        >

          <div>

            <span
              class="data-transfer-eyebrow"
            >
              IMPORT
            </span>

            <h2>
              Carica dati
            </h2>

            <p>
              Le sorgenti verranno
              collegate nella fase
              database.
            </p>

          </div>

        </div>

        <div
          class="data-transfer-grid"
        >

          ${IMPORT_CARDS
            .map(
              (card) =>
                renderCard(
                  card,
                  'import',
                ),
            )
            .join('')}

        </div>

      </section>

      <section
        class="data-transfer-section"
      >

        <div
          class="data-transfer-section-header"
        >

          <div>

            <span
              class="data-transfer-eyebrow"
            >
              EXPORT
            </span>

            <h2>
              Esporta dati
            </h2>

            <p>
              Per ora prevediamo solo
              l’esportazione dello
              storico.
            </p>

          </div>

        </div>

        <div
          class="
            data-transfer-grid
            data-transfer-grid-single
          "
        >

          ${EXPORT_CARDS
            .map(
              (card) =>
                renderCard(
                  card,
                  'export',
                ),
            )
            .join('')}

        </div>

      </section>

      <section
        class="data-integrity-panel"
      >

        <div
          class="data-integrity-icon"
        >
          ✓
        </div>

        <div>

          <span
            class="data-transfer-eyebrow"
          >
            VALIDAZIONE
          </span>

          <h2>
            Prima validare, poi applicare
          </h2>

          <p>
            Quando collegheremo i file
            reali, MisterCanà dovrà
            controllare struttura e dati
            prima di modificare
            l’archivio interno.

            Un import non valido non
            dovrà sovrascrivere dati già
            presenti.
          </p>

        </div>

      </section>

    </section>
  `
}