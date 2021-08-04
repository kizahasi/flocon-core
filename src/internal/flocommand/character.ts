import {
    FObject,
    FString,
    FValue,
    OnGettingParams,
    OnSettingParams,
    ScriptError,
    beginCast,
} from '@kizahasi/flocon-script';
import * as Character from '../ot/room/character/v1';
import * as Room from '../ot/room/v1';
import { toFFilePath, toFilePath } from './filePath';
import { FNumParams } from './numParams';

const icon = 'icon';
const name = 'name';
const numberParameters = 'numberParameters';
const maxNumberParameters = 'maxNumberParameters';
const portrait = 'portrait';

export class FCharacter extends FObject {
    public constructor(
        public readonly character: Character.State,
        private readonly room: Room.State
    ) {
        super();
    }

    override getCore({ key, astInfo }: OnGettingParams): FValue {
        switch (key) {
            case icon:
                return this.character.image == null
                    ? null
                    : toFFilePath(this.character.image, astInfo);
            case maxNumberParameters:
                return new FNumParams(this.character.numMaxParams, this.room);
            case name:
                return new FString(this.character.name);
            case numberParameters:
                return new FNumParams(this.character.numParams, this.room);
            case portrait:
                return this.character.tachieImage == null
                    ? null
                    : toFFilePath(this.character.tachieImage, astInfo);
            default:
                return undefined;
        }
    }

    override setCore({ key, newValue, astInfo }: OnSettingParams): void {
        switch (key) {
            case icon: {
                const $newValue = beginCast(newValue).addObject().cast(astInfo?.range);
                this.character.image = toFilePath($newValue, astInfo);
                return;
            }
            case name: {
                const $newValue = beginCast(newValue).addString().cast(astInfo?.range);
                this.character.name = $newValue;
                return;
            }
            case maxNumberParameters:
            case numberParameters: {
                throw new ScriptError(`${key}は読み取り専用プロパティです。`);
            }
            case portrait: {
                const $newValue = beginCast(newValue).addObject().cast(astInfo?.range);
                this.character.tachieImage = toFilePath($newValue, astInfo);
                return;
            }
            default:
                throw new ScriptError(`'${key}' is not supported.`, astInfo?.range);
        }
    }

    override toJObject(): unknown {
        return this.character;
    }
}
