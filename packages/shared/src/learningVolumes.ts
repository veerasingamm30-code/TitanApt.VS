export type LearningVolumeDefinition = {
  slug: string;
  title: string;
  filename: string;
  pageCount: number;
  /** Historical source path (kept for provenance notes; may not exist on disk). */
  sourcePath: string;
  /** The original supplied reference filename inside the Img-pdf reference folder. */
  referencePath: string;
  /** Browser-served copy bundled with the web app. */
  resourceUrl: string;
};

export const LEARNING_VOLUMES: LearningVolumeDefinition[] = [
  {
    slug: 'volume-1',
    title: 'Volume 1 · Quant Foundations',
    filename: 'Aptitude_Mastery_Vol1_Quant_Foundations.pdf',
    pageCount: 97,
    sourcePath: 'Aptitude/Learning Hub.pdf/Aptitude_Mastery_Vol1_Quant_Foundations.pdf',
    referencePath: 'Img-pdf/Volume 1.pdf',
    resourceUrl: '/resources/volume-1.pdf',
  },
  {
    slug: 'volume-2',
    title: 'Volume 2 · Quantitative Aptitude Advanced',
    filename: 'Volume_2_Quantitative_Aptitude_Advanced.pdf',
    pageCount: 122,
    sourcePath: 'Aptitude/Learning Hub.pdf/Volume_2_Quantitative_Aptitude_Advanced.pdf',
    referencePath: 'Img-pdf/Volume 2.pdf',
    resourceUrl: '/resources/volume-2.pdf',
  },
  {
    slug: 'volume-3',
    title: 'Volume 3 · Logical Reasoning',
    filename: 'Volume3_Logical_Reasoning.pdf',
    pageCount: 88,
    sourcePath: 'Aptitude/Learning Hub.pdf/Volume3_Logical_Reasoning.pdf',
    referencePath: 'Img-pdf/Volume 3.pdf',
    resourceUrl: '/resources/volume-3.pdf',
  },
  {
    slug: 'volume-4',
    title: 'Volume 4 · Verbal Ability, Grammar & Vocabulary',
    filename: 'Volume_4_Verbal_Ability_English_Grammar_Vocabulary.pdf',
    pageCount: 152,
    sourcePath: 'Aptitude/Learning Hub.pdf/Volume_4_Verbal_Ability_English_Grammar_Vocabulary.pdf',
    referencePath: 'Img-pdf/Volume 4.pdf',
    resourceUrl: '/resources/volume-4.pdf',
  },
  {
    slug: 'volume-5',
    title: 'Volume 5 · Abstract & General Aptitude',
    filename: 'Volume5_Abstract_and_General_Aptitude.pdf',
    pageCount: 104,
    sourcePath: 'Aptitude/Learning Hub.pdf/Volume5_Abstract_and_General_Aptitude.pdf',
    referencePath: 'Img-pdf/Volume 5.pdf',
    resourceUrl: '/resources/volume-5.pdf',
  },
  {
    slug: 'volume-6',
    title: 'Volume 6 · Programming & Technical',
    filename: 'Aptitude_Mastery_Volume6_Programming_Technical.pdf',
    pageCount: 142,
    sourcePath: 'Aptitude/Learning Hub.pdf/Aptitude_Mastery_Volume6_Programming_Technical.pdf',
    referencePath: 'Img-pdf/Volume 6.pdf',
    resourceUrl: '/resources/volume-6.pdf',
  },
  {
    slug: 'volume-7',
    title: 'Volume 7 · Placement Practice & Mock Tests',
    filename: 'Aptitude_Mastery_Volume7_Placement_Practice_Mock_Tests.pdf',
    pageCount: 48,
    sourcePath: 'Aptitude/Learning Hub.pdf/Aptitude_Mastery_Volume7_Placement_Practice_Mock_Tests.pdf',
    referencePath: 'Img-pdf/Volume 7.pdf',
    resourceUrl: '/resources/volume-7.pdf',
  },
  {
    slug: 'volume-8',
    title: 'Volume 8 · Complete Aptitude Mastery',
    filename: 'Complete_Aptitude_Mastery_Volume_8.pdf',
    pageCount: 64,
    sourcePath: 'Aptitude/Learning Hub.pdf/Complete_Aptitude_Mastery_Volume_8.pdf',
    referencePath: 'Img-pdf/Volume 8.pdf',
    resourceUrl: '/resources/volume-8.pdf',
  },
];
