import { LanguageCode } from "./Language.js";

export interface LocalizedString {
    language: LanguageCode
    content: string
}

// aliasing the interface for semantic reasons
export type GlossIdentifier = LocalizedString