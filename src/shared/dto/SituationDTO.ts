import { GlossDTO } from "./GlossDTO"
import { LocalizedString } from "../LocalizedString"
import { LanguageCode } from "../Language"

export interface SituationDTO {
    id: string
    descriptions: LocalizedString[]
    imageLink?: string
    targetLanguage: LanguageCode
    nativeLanguage: LanguageCode

    challengesOfUnderstandingText: GlossDTO[]
    challengesOfExpression: GlossDTO[]
}
