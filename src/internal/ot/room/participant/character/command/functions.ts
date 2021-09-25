import * as TextOperation from '../../../../util/textOperation';
import {
    Apply,
    ClientTransform,
    Compose,
    Diff,
    Restore,
    ServerTransform,
    ToClientOperationParams,
} from '../../../../util/type';
import { isIdRecord } from '../../../../util/record';
import { Result } from '@kizahasi/result';
import * as ReplaceOperation from '../../../../util/replaceOperation';
import { DownOperation, State, TwoWayOperation, UpOperation } from './types';

export const toClientState = (source: State): State => {
    return source;
};

export const toClientOperation = ({
    diff,
}: ToClientOperationParams<State, TwoWayOperation>): UpOperation => {
    return {
        ...diff,
        value: diff.value == null ? undefined : TextOperation.toUpOperation(diff.value),
    };
};

export const toDownOperation = (source: TwoWayOperation): DownOperation => {
    return {
        ...source,
        value: source.value == null ? undefined : TextOperation.toDownOperation(source.value),
    };
};

export const toUpOperation = (source: TwoWayOperation): UpOperation => {
    return {
        ...source,
        value: source.value == null ? undefined : TextOperation.toUpOperation(source.value),
    };
};

export const apply: Apply<State, UpOperation | TwoWayOperation> = ({ state, operation }) => {
    const result: State = { ...state };

    if (operation.name != null) {
        result.name = operation.name.newValue;
    }
    if (operation.value != null) {
        const valueResult = TextOperation.apply(state.value, operation.value);
        if (valueResult.isError) {
            return valueResult;
        }
        result.value = valueResult.value;
    }
    return Result.ok(result);
};

export const applyBack: Apply<State, DownOperation> = ({ state, operation }) => {
    const result = { ...state };

    if (operation.name != null) {
        result.name = operation.name.oldValue;
    }
    if (operation.value !== undefined) {
        const prevValue = TextOperation.applyBack(state.value, operation.value);
        if (prevValue.isError) {
            return prevValue;
        }
        result.value = prevValue.value;
    }

    return Result.ok(result);
};

export const composeDownOperation: Compose<DownOperation> = ({ first, second }) => {
    const value = TextOperation.composeDownOperation(first.value, second.value);
    if (value.isError) {
        return value;
    }
    const valueProps: DownOperation = {
        $v: 1,
        name: ReplaceOperation.composeDownOperation(first.name, second.name),
        value: value.value,
    };
    return Result.ok(valueProps);
};

export const restore: Restore<State, DownOperation, TwoWayOperation> = ({
    nextState,
    downOperation,
}) => {
    if (downOperation == null) {
        return Result.ok({
            prevState: nextState,
            nextState,
            twoWayOperation: undefined,
        });
    }

    const prevState: State = { ...nextState };
    const twoWayOperation: TwoWayOperation = { $v: 1 };

    if (downOperation.name != null) {
        prevState.name = downOperation.name.oldValue;
        twoWayOperation.name = {
            oldValue: downOperation.name.oldValue,
            newValue: nextState.name,
        };
    }

    if (downOperation.value != null) {
        const restored = TextOperation.restore({
            nextState: nextState.value,
            downOperation: downOperation.value,
        });
        if (restored.isError) {
            return restored;
        }
        prevState.value = restored.value.prevState;
        twoWayOperation.value = restored.value.twoWayOperation;
    }

    return Result.ok({ prevState, nextState, twoWayOperation });
};

export const diff: Diff<State, TwoWayOperation> = ({ prevState, nextState }) => {
    const resultType: TwoWayOperation = { $v: 1 };

    if (prevState.name !== nextState.name) {
        resultType.name = {
            oldValue: prevState.name,
            newValue: nextState.name,
        };
    }
    if (prevState.value !== nextState.value) {
        resultType.value = TextOperation.diff({
            prev: prevState.value,
            next: nextState.value,
        });
    }
    if (isIdRecord(resultType)) {
        return undefined;
    }
    return resultType;
};

export const serverTransform: ServerTransform<State, TwoWayOperation, UpOperation> = ({
    prevState,
    currentState,
    clientOperation,
    serverOperation,
}) => {
    const twoWayOperation: TwoWayOperation = {
        $v: 1,
        name: ReplaceOperation.serverTransform({
            first: serverOperation?.name,
            second: clientOperation.name,
            prevState: prevState.name,
        }),
    };

    const value = TextOperation.serverTransform({
        first: serverOperation?.value,
        second: clientOperation.value,
        prevState: prevState.value,
    });
    if (value.isError) {
        return value;
    }
    twoWayOperation.value = value.value.secondPrime;

    if (isIdRecord(twoWayOperation)) {
        return Result.ok(undefined);
    }

    return Result.ok(twoWayOperation);
};

export const clientTransform: ClientTransform<UpOperation> = ({ first, second }) => {
    const name = ReplaceOperation.clientTransform({ first: first.name, second: second.name });

    const value = TextOperation.clientTransform({
        first: first.value,
        second: second.value,
    });
    if (value.isError) {
        return value;
    }

    const firstPrime: UpOperation = {
        $v: 1,
        name: name.firstPrime,
        value: value.value.firstPrime,
    };

    const secondPrime: UpOperation = {
        $v: 1,
        name: name.secondPrime,
        value: value.value.secondPrime,
    };

    return Result.ok({
        firstPrime: isIdRecord(firstPrime) ? undefined : firstPrime,
        secondPrime: isIdRecord(secondPrime) ? undefined : secondPrime,
    });
};