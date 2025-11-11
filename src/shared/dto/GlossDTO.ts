import { GlossIdentfier } from "../LocalizedString";
import { Note } from "../Note";

export interface GlossDTO extends GlossIdentfier {
    id: string;
    isParaphrased: boolean;
    transcriptions: string[];
    notes: Note[];

    contains: GlossDTO[];
    nearSynonyms: GlossDTO[];
    nearHomophones: GlossDTO[];
    translations: GlossDTO[];
}
