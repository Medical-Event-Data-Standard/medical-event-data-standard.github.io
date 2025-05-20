import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<"svg">>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Shockingly Simple",
    Svg: require("@site/static/img/shockingly_simple.svg").default,
    PNG: null,
    description: (
      <>
        MEDS (Medical Event Data Standard) is the simplest possible standard for
        health AI, making it easy to use with diverse data sources and modelling
        needs.
      </>
    ),
  },
  {
    title: "Health AI Ecosystem",
    Svg: require("@site/static/img/built_for_AI.svg").default,
    PNG: null,
    description: (
      <>
        MEDS empowers a high-performance and flexible health AI ecosystem to
        streamline your research via parallelism and sparse data structures.
      </>
    ),
  },
  {
    title: "Frictionless Reproducibility",
    // Svg: require('@site/static/img/frictionless_reproducibility.svg').default,
    PNG: require("@site/static/img/frictionless_reproducibility.png").default,
    description: (
      <>
        MEDS ensures that your models, tools, and pipelines are easily
        reproducible across data sites, research tasks, and computational
        environments.
      </>
    ),
  },
];

function Feature({ title, Svg, PNG, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        {PNG && <img src={PNG} className={styles.featurePng} />}
        {Svg && <Svg className={styles.featureSvg} />}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
