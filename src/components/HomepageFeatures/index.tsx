import clsx from 'clsx';
import Heading from '@theme/Heading';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  // Path of an image under static/. SVGs are deliberately loaded with <img> rather than imported as
  // React components: Docusaurus' SVGO step renames every inlined SVG's ids to a, b, c, ..., so two
  // inlined SVGs on one page resolve each other's `url(#a)` masks and parts of the artwork vanish.
  image: string;
  description: React.JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Shockingly Simple',
    image: '/img/shockingly_simple.svg',
    description: (
      <>
        MEDS (Medical Event Data Standard) is the simplest possible standard for health AI, making it easy to
        use with diverse data sources and modelling needs.
      </>
    ),
  },
  {
    title: 'Health AI Ecosystem',
    image: '/img/built_for_AI.svg',
    description: (
      <>
        MEDS empowers a high-performance and flexible health AI ecosystem to streamline your research via
        parallelism and sparse data structures.
      </>
    ),
  },
  {
    title: 'Frictionless Reproducibility',
    image: '/img/frictionless_reproducibility.png',
    description: (
      <>
        MEDS ensures that your models, tools, and pipelines are easily reproducible across data sites,
        research tasks, and computational environments.
      </>
    ),
  },
];

function Feature({ title, image, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img src={useBaseUrl(image)} className={styles.featureImage} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): React.JSX.Element {
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
