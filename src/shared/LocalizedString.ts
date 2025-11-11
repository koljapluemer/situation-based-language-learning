import { LanguageCode } from "./Language";

export interface LocalizedString {
    language: LanguageCode
    content: string
}

// aliasing the interface for semantic reasons
export type GlossIdentfier = LocalizedString