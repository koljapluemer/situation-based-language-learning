import { GlossDTO } from "./GlossDTO.js"
import { LocalizedString } from "../LocalizedString.js"
import { LanguageCode } from "../Language.js"

export interface SituationDTO {
    id: string
    descriptions: LocalizedString[]
    imageLink?: string
    targetLanguage: LanguageCode
    nativeLanguage: LanguageCode

    challengesOfUnderstandingText: GlossDTO[]
    challengesOfExpression: GlossDTO[]
}
