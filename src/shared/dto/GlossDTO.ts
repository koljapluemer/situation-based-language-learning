import { GlossIdentfier } from "../LocalizedString";
import { Note } from "../Note";


export interface GlossDTO extends GlossIdentfier {
    isParaphrased: boolean
    transcriptions: string[]
    notes: Note[]
    
    contains: GlossIdentfier[]
    nearSynonyms: GlossIdentfier[]
    nearHomophones: GlossIdentfier[]
    translations: GlossIdentfier[]
}