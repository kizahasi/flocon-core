import { Result } from '@kizahasi/result';
import * as t from 'io-ts';
import { createOperation } from '../util/createOperation';
import { isIdRecord } from '../util/record';
import * as ReplaceOperation from '../util/replaceOperation';
import * as TextOperation from '../util/textOperation';
import {
    Apply,
    ClientTransform,
    Compose,
    Diff,
    Restore,
    ServerTransform,
    ToClientOperationParams,
} from '../util/type';

export const Plain = 'Plain';
export const MarkDown = 'MarkDown';

const textType = t.union([t.literal(Plain), t.literal(MarkDown)]);
type TextType = t.TypeOf<typeof textType>;

export const state = t.type({
    $version: t.literal(1),

    name: t.string,
    text: t.string,
    textType,
});

export type State = t.TypeOf<typeof state>;

export const downOperation = createOperation(1, {
    name: t.type({ oldValue: t.string }),
    text: TextOperation.downOperation,
    textType: t.type({ oldValue: textType }),
});

export type DownOperation = t.TypeOf<typeof downOperation>;

export const upOperation = createOperation(1, {
    name: t.type({ newValue: t.string }),
    text: TextOperation.upOperation,
    textType: t.type({ newValue: textType }),
});

export type UpOperation = t.TypeOf<typeof upOperation>;

export type TwoWayOperation = {
    $version: 1;

    name?: ReplaceOperation.ReplaceValueTwoWayOperation<string>;
    text?: TextOperation.TwoWayOperation;
    textType?: ReplaceOperation.ReplaceValueTwoWayOperation<TextType>;
};

export const toClientState = (source: State): State => source;

export const toClientOperation = ({
    diff,
}: ToClientOperationParams<State, TwoWayOperation>): UpOperation => {
    return {
        ...diff,
        text: diff.text == null ? undefined : TextOperation.toUpOperation(diff.text),
    };
};

export const toDownOperation = (source: TwoWayOperation): DownOperation => {
    return {
        ...source,
        text: source.text == null ? undefined : TextOperation.toDownOperation(source.text),
    };
};

export const toUpOperation = (source: TwoWayOperation): UpOperation => {
    return {
        ...source,
        text: source.text == null ? undefined : TextOperation.toUpOperation(source.text),
    };
};

export const apply: Apply<State, UpOperation | TwoWayOperation> = ({ state, operation }) => {
    const result: State = { ...state };

    if (operation.name != null) {
        result.name = operation.name.newValue;
    }
    if (operation.text != null) {
        const applied = TextOperation.apply(state.text, operation.text);
        if (applied.isError) {
            return applied;
        }
        result.text = applied.value;
    }
    if (operation.textType != null) {
        result.textType = operation.textType.newValue;
    }

    return Result.ok(result);
};

export const applyBack: Apply<State, DownOperation> = ({ state, operation }) => {
    const result = { ...state };

    if (operation.name !== undefined) {
        result.name = operation.name.oldValue;
    }
    if (operation.text != null) {
        const applied = TextOperation.applyBack(state.text, operation.text);
        if (applied.isError) {
            return applied;
        }
        result.text = applied.value;
    }
    if (operation.textType !== undefined) {
        result.textType = operation.textType.oldValue;
    }

    return Result.ok(result);
};

export const composeUpOperation: Compose<UpOperation> = ({ first, second }) => {
    const text = TextOperation.composeUpOperation(first.text, second.text);
    if (text.isError) {
        return text;
    }
    const valueProps: UpOperation = {
        $version: 1,
        name: ReplaceOperation.composeUpOperation(first.name, second.name),
        text: text.value,
        textType: ReplaceOperation.composeUpOperation(first.textType, second.textType),
    };
    return Result.ok(valueProps);
};

export const composeDownOperation: Compose<DownOperation> = ({ first, second }) => {
    const text = TextOperation.composeDownOperation(first.text, second.text);
    if (text.isError) {
        return text;
    }
    const valueProps: DownOperation = {
        $version: 1,
        name: ReplaceOperation.composeDownOperation(first.name, second.name),
        text: text.value,
        textType: ReplaceOperation.composeDownOperation(first.textType, second.textType),
    };
    return Result.ok(valueProps);
};

export const restore: Restore<State, DownOperation, TwoWayOperation> = ({
    nextState,
    downOperation,
}) => {
    if (downOperation === undefined) {
        return Result.ok({ prevState: nextState, twoWayOperation: undefined });
    }

    const prevState: State = { ...nextState };
    const twoWayOperation: TwoWayOperation = { $version: 1 };

    if (downOperation.name !== undefined) {
        prevState.name = downOperation.name.oldValue;
        twoWayOperation.name = {
            ...downOperation.name,
            newValue: nextState.name,
        };
    }
    if (downOperation.text !== undefined) {
        const restored = TextOperation.restore({
            nextState: nextState.text,
            downOperation: downOperation.text,
        });
        if (restored.isError) {
            return restored;
        }
        prevState.text = restored.value.prevState;
        twoWayOperation.text = restored.value.twoWayOperation;
    }
    if (downOperation.textType !== undefined) {
        prevState.textType = downOperation.textType.oldValue;
        twoWayOperation.textType = {
            ...downOperation.textType,
            newValue: nextState.textType,
        };
    }

    return Result.ok({ prevState, twoWayOperation });
};

export const diff: Diff<State, TwoWayOperation> = ({ prevState, nextState }) => {
    const resultType: TwoWayOperation = { $version: 1 };

    if (prevState.name !== nextState.name) {
        resultType.name = {
            oldValue: prevState.name,
            newValue: nextState.name,
        };
    }
    if (prevState.text !== nextState.text) {
        resultType.text = TextOperation.diff({ prev: prevState.name, next: nextState.name });
    }
    if (prevState.textType !== nextState.textType) {
        resultType.textType = {
            oldValue: prevState.textType,
            newValue: nextState.textType,
        };
    }

    if (isIdRecord(resultType)) {
        return undefined;
    }
    return resultType;
};

export const serverTransform: ServerTransform<State, TwoWayOperation, UpOperation> = ({
    prevState,
    clientOperation,
    serverOperation,
}) => {
    const twoWayOperation: TwoWayOperation = { $version: 1 };

    twoWayOperation.name = ReplaceOperation.serverTransform({
        first: serverOperation?.name,
        second: clientOperation.name,
        prevState: prevState.name,
    });

    const transformed = TextOperation.serverTransform({
        first: serverOperation?.text,
        second: clientOperation.text,
        prevState: prevState.text,
    });
    if (transformed.isError) {
        return transformed;
    }
    twoWayOperation.text = transformed.value.secondPrime;

    twoWayOperation.textType = ReplaceOperation.serverTransform({
        first: serverOperation?.textType,
        second: clientOperation.textType,
        prevState: prevState.textType,
    });

    if (isIdRecord(twoWayOperation)) {
        return Result.ok(undefined);
    }

    return Result.ok({ ...twoWayOperation });
};

export const clientTransform: ClientTransform<UpOperation> = ({ first, second }) => {
    const name = ReplaceOperation.clientTransform({
        first: first.name,
        second: second.name,
    });

    const text = TextOperation.clientTransform({
        first: first.text,
        second: second.text,
    });
    if (text.isError) {
        return text;
    }

    const textType = ReplaceOperation.clientTransform({
        first: first.textType,
        second: second.textType,
    });

    const firstPrime: UpOperation = {
        $version: 1,
        name: name.firstPrime,
        text: text.value.firstPrime,
        textType: textType.firstPrime,
    };

    const secondPrime: UpOperation = {
        $version: 1,
        name: name.secondPrime,
        text: text.value.secondPrime,
        textType: textType.secondPrime,
    };

    return Result.ok({
        firstPrime: isIdRecord(firstPrime) ? undefined : firstPrime,
        secondPrime: isIdRecord(secondPrime) ? undefined : secondPrime,
    });
};