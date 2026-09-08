import type { ReactNode } from "react";
import type { FormatRepoPackageData } from "./formatRepoPackage.server";
import type { DiscoveryFormatProfile } from "./types";

type Props = {
  format: DiscoveryFormatProfile;
  data: FormatRepoPackageData | null;
};
const card =
  "rounded-lg border-2 border-[#080817] bg-white shadow-[4px_4px_0_#080817]";

function Section({
  id,
  eyebrow,
  title,
  blue = false,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  blue?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-6 border-y-2 border-[#080817] px-4 py-[58px] sm:px-7 ${blue ? "bg-[#dff8ff]" : "bg-[#fffdf8]"}`}
    >
      <div className="mx-auto max-w-[980px]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#596176]">
          {eyebrow}
        </p>
        <h2
          id={`${id}-title`}
          className="mt-3 text-[clamp(34px,5vw,54px)] font-black leading-[0.96] tracking-[-0.04em]"
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function BulletList({ values }: { values: string[] }) {
  return (
    <ul className="mt-4 grid list-disc gap-3 pl-5 text-sm font-bold leading-6 text-[#424254]">
      {values.map((value, index) => (
        <li key={index}>{value}</li>
      ))}
    </ul>
  );
}

export function FormatRepoPackageConnections({ format, data }: Props) {
  return (
    <Section
      id="accounts-youll-connect"
      eyebrow="Before you start"
      title="Services & costs"
      blue
    >
      {data ? (
        <>
          <div className="mt-6 overflow-hidden rounded-lg border-2 border-[#080817] bg-white">
            {data.services.map((service) => (
              <article
                key={service.name}
                className="grid gap-4 border-b-2 border-[#080817] p-5 sm:grid-cols-[0.8fr_1.2fr]"
              >
                <div>
                  <h3 className="text-xl font-black">{service.name}</h3>
                  {service.model ? (
                    <p className="mt-2 break-words text-xs font-bold text-[#596176]">
                      {service.model}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-bold leading-6">
                    {service.purpose}
                  </p>
                  {service.keys.map((key) => (
                    <code
                      key={key}
                      className="mt-2 block break-all text-xs text-[#596176]"
                    >
                      {key}
                    </code>
                  ))}
                </div>
              </article>
            ))}
            <article className="grid gap-4 p-5 sm:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h3 className="text-xl font-black">Local runtime</h3>
                <p className="mt-2 text-xs font-bold text-[#596176]">
                  {data.services.length
                    ? "Setup, validation & inspection"
                    : "No media API account required"}
                </p>
              </div>
              <p className="text-sm font-bold leading-6">
                {data.tools.join(" · ") ||
                  "Use the tools listed in the packaged requirements.json."}
              </p>
            </article>
          </div>
          {data.optionalTools.length ? (
            <div className="mt-5 text-sm font-bold text-[#31566e]">
              <h3 className="font-black">Optional local tools</h3>
              <BulletList values={data.optionalTools} />
            </div>
          ) : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-[#080817] bg-[#c9ff55] p-5">
              <p className="text-xs font-black uppercase tracking-wider">
                Typical run estimate
              </p>
              <p className="mt-2 text-lg font-black">
                {format.handoff?.totalEstimate ||
                  "Confirm the estimate before starting."}
              </p>
            </div>
            <p className="text-sm font-bold leading-6 text-[#31566e]">
              Estimates describe the saved recipe, not a price guarantee.
              Confirm current provider pricing and approve any spend before
              generation. Your coding agent may have its own fees or usage
              limits. Never paste API keys into chat.
            </p>
          </div>
          {data.notes.length ? (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-black">
                Setup notes from requirements.json
              </summary>
              <BulletList values={data.notes} />
            </details>
          ) : null}
        </>
      ) : (
        <p className="mt-6 max-w-2xl text-lg font-bold leading-8 text-[#424254]">
          This is a public example collection. A runnable Repo, provider
          requirements, and cost estimate have not been published for this
          format.
        </p>
      )}
    </Section>
  );
}

export function FormatRepoPackageAssets({ format, data }: Props) {
  // Squilliam already presents its characters interactively in the anchor chooser.
  // Keep the complete inventory in Repo files, not a second gallery of rig textures.
  if (format.slug === "squilliam-news") return null;
  const visualAssets = data?.assets.filter((asset) => asset.image) ?? [];
  const gridCols =
    visualAssets.length % 4 === 0
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : "sm:grid-cols-2 lg:grid-cols-3";
  function assetGrid(assets: typeof visualAssets) {
    return (
      <div className={`mt-6 grid gap-4 ${gridCols}`}>
        {assets.map((asset) => (
          <article key={asset.href} className={`${card} overflow-hidden`}>
            <a
              href={asset.href}
              target="_blank"
              rel="noreferrer"
              className="block bg-[#f5f1e8]"
              aria-label={`Open ${asset.label}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.href}
                alt={asset.label}
                loading="lazy"
                className="aspect-[4/3] w-full object-contain p-3"
              />
            </a>
            <div className="border-t-2 border-[#080817] p-4">
              <h3 className="text-lg font-black">{asset.label}</h3>
              <p className="mt-2 text-xs font-bold leading-5 text-[#596176]">
                {asset.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    );
  }
  const initialLimit = visualAssets.length <= 8 ? visualAssets.length : 6;
  return (
    <Section
      id="included-assets"
      eyebrow="Included assets"
      title={
        data
          ? "The ingredients behind the format."
          : "What the examples demonstrate."
      }
    >
      {data ? (
        <p className="mt-5 max-w-2xl text-base font-bold leading-7 text-[#596176]">
          The published package includes its agent instructions, input contract,
          and quality rules
          {visualAssets.length
            ? `, plus ${visualAssets.length} viewable asset ${visualAssets.length === 1 ? "reference" : "references"} below`
            : ""}
          . Reference media teaches the recipe; it is not a new result for your
          input.
        </p>
      ) : null}
      {assetGrid(visualAssets.slice(0, initialLimit))}
      {visualAssets.length > initialLimit ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-black">
            View all {visualAssets.length} asset references
          </summary>
          {assetGrid(visualAssets.slice(initialLimit))}
        </details>
      ) : null}
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div className={`${card} p-6`}>
          <h3 className="text-xl font-black">What stays consistent</h3>
          <BulletList values={format.whatStays} />
        </div>
        <div className={`${card} p-6`}>
          <h3 className="text-xl font-black">What you bring</h3>
          <BulletList
            values={format.handoff?.requiredInputs ?? format.whatChanges}
          />
        </div>
      </div>
      {data ? (
        <a
          href="#repo-files"
          className="mt-6 inline-block text-sm font-black underline decoration-2 underline-offset-4"
        >
          Read the included contracts and asset inventory ↓
        </a>
      ) : null}
    </Section>
  );
}

export function FormatRepoPackageEvidence({ format, data }: Props) {
  return (
    <>
      <Section
        id="workflow"
        eyebrow="From input to output"
        title="How the run works."
      >
        {data ? (
          <>
            <p className="mt-5 text-sm font-bold text-[#596176]">
              From the published {data.workflowSource}. The agent follows the
              packaged runtime and its approval gates.
            </p>
            <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.workflow.map((step, index) => (
                <li key={index} className={`${card} p-5`}>
                  <p className="text-xs font-black uppercase tracking-wider text-[#596176]">
                    Step {String(index + 1).padStart(2, "0")}
                    {step.approval ? " · approval" : ""}
                    {step.provider ? " · provider" : ""}
                  </p>
                  <h3 className="mt-3 text-xl font-black">{step.title}</h3>
                  {step.description ? (
                    <p className="mt-3 break-words text-sm font-bold leading-6 text-[#424254]">
                      {step.description.replace(/`|\*\*/g, "")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="mt-5 text-lg font-bold leading-8 text-[#424254]">
            No executable workflow is published yet. Browse the saved examples;
            this page is not an agent-ready download.
          </p>
        )}
      </Section>
      <Section
        id="proof-quality"
        eyebrow="Proof & quality"
        title="What a good result looks like."
        blue
      >
        <p className="mt-5 max-w-3xl text-lg font-bold leading-8 text-[#424254]">
          {data?.proof.purpose ||
            "The examples above are saved reference outputs. They are not evidence that a new input has passed the quality checks."}
        </p>
        {data?.proof.notes.map((note, index) => (
          <p
            key={index}
            className="mt-3 text-sm font-bold leading-6 text-[#31566e]"
          >
            {note}
          </p>
        ))}
        {data?.proof.contactSheet ? (
          <a
            href={data.proof.contactSheet}
            className="mt-6 block"
            target="_blank"
            rel="noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.proof.contactSheet}
              alt={`${format.name} canonical proof contact sheet`}
              loading="lazy"
              className="w-full rounded-lg border-2 border-[#080817]"
            />
          </a>
        ) : null}
        {data ? (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {data.proof.examples.slice(0, format.slug === "repo-builder" ? 3 : 2).map((example, index) => (
                <article key={index} className={`${card} p-6`}>
                  <p className="text-xs font-black uppercase tracking-wider text-[#596176]">
                    {example.role || "Saved reference"}
                  </p>
                  <h3 className="mt-2 text-2xl font-black">{example.title}</h3>
                  <BulletList values={example.strengths} />
                  {example.weaknesses.length ? (
                    <>
                      <h4 className="mt-5 font-black">Known limitations</h4>
                      <BulletList values={example.weaknesses} />
                    </>
                  ) : null}
                </article>
              ))}
            </div>
            <h3 className="mt-9 text-2xl font-black">Quality gates</h3>
            <p className="mt-3 text-sm font-bold leading-6 text-[#31566e]">
              These are the acceptance criteria in quality.json—not a claim that
              every pictured example passed the current version. Inspect each
              new output before finalizing.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {data.quality.map((group, index) => (
                <details
                  key={group.title}
                  open={index < 2}
                  className={`${card} p-5`}
                >
                  <summary className="cursor-pointer text-lg font-black">
                    {group.title}{" "}
                    <span className="text-sm text-[#596176]">
                      · {group.checks.length} checks
                    </span>
                  </summary>
                  <BulletList values={group.checks} />
                </details>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm font-bold">
            A versioned quality contract and reproducibility report are not
            published yet.
          </p>
        )}
      </Section>
      <Section
        id="repo-files"
        eyebrow="Open the package"
        title="Readable Repo files."
      >
        {data ? (
          <>
            <p className="mt-5 max-w-2xl text-base font-bold leading-7 text-[#596176]">
              Actual files from the published v{format.version} package. Expand
              any file to inspect the instructions, requirements, or evidence
              before sending the Repo to your agent.
            </p>
            <div className="mt-7 overflow-hidden rounded-lg border-2 border-[#080817] bg-white">
              {data.files.map((file) => (
                <details
                  key={file.name}
                  className="border-b border-[#c9ced9] last:border-b-0"
                >
                  <summary className="cursor-pointer break-words px-5 py-4 text-sm font-black">
                    {file.name}
                  </summary>
                  <div className="border-t border-[#c9ced9] bg-[#f5f1e8] p-5">
                    <a
                      href={file.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-black underline underline-offset-4"
                    >
                      Open raw file ↗
                    </a>
                    <pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap break-words text-xs leading-6">
                      {file.content}
                    </pre>
                  </div>
                </details>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-5 text-lg font-bold text-[#424254]">
            No downloadable Repo or source files are published for this
            collection yet.
          </p>
        )}
        {format.technicalHref ? (
          <a
            href={format.technicalHref}
            className="mt-6 inline-block text-sm font-black underline decoration-2 underline-offset-4"
          >
            Technical proof archive ↗
          </a>
        ) : null}
      </Section>
    </>
  );
}
