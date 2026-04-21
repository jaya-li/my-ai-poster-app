export type DirectionOption = {
  key: "A" | "B" | "C" | "D";
  title: string;
  content: string;
};

export type ThemeDirectionsResponse = {
  theme: string;
  options: DirectionOption[];
};

export type UploadedReferenceImages = {
  layoutBase64?: string;
  styleBase64?: string;
  ipBase64?: string;
  coinBase64?: string;
  layoutMimeType?: string;
  styleMimeType?: string;
  ipMimeType?: string;
  coinMimeType?: string;
};

export type GenerateKvRequest = {
  theme: string;
  selectedOptions: ("A" | "B" | "C" | "D")[];
  optionContents: DirectionOption[];
  images: UploadedReferenceImages;
};

export type GeneratedImageResult = {
  optionKey: "A" | "B" | "C" | "D";
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
};

export type GenerateKvResponse = {
  results: GeneratedImageResult[];
};

export type GenerateCopyRequest = {
  theme: string;
  selectedOptionKey: "A" | "B" | "C" | "D";
  selectedOptionContent: string;
};

export type PromoCopyResponse = {
  headline: string;
  subheadline: string;
  description: string;
};

export type GenerateBannerRequest = {
  theme: string;
  selectedOptionKey: "A" | "B" | "C" | "D";
  selectedOptionContent: string;
  mainVisualUrl: string;
  headline: string;
  subheadline: string;
  description: string;
};
