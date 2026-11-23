import { Component, type ReactNode } from 'react';

import { PartLoadError } from '../app/lazyPart';
import { LoadError, RenderError } from './LoadState';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** 따로 불러오는 조각을 감쌀 때: 조각을 다시 불러오게 하는 함수(app/lazyPart의 `retry`) */
  onRetryPart?: () => void;
};

type ErrorBoundaryState = {
  failed: boolean;
  error: unknown;
  /** 조각을 이미 한 번 다시 불러와 봤다 */
  retriedPart: boolean;
};

/**
 * 오류 경계: 안쪽에서 그리다 난 예외가 사이트 전체를 빈 화면으로 만들지 않게 그 자리에 안내를 보여 준다.
 * - 조각을 받지 못함(PartLoadError): "불러오지 못했어요" + [다시 시도]. 한 번은 조각만 다시 받아 보고,
 *   그래도 안 되면(또는 다시 받을 방법이 없으면) 사이트를 새로 고친다.
 * - 그 밖의 예외: "화면을 그리지 못했어요" + [새로 고침].
 * 예외 내용은 React가 콘솔에 남기므로 여기서 따로 찍지 않는다.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, error: null, retriedPart: false };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { failed: true, error };
  }

  retryPart = () => {
    const { onRetryPart } = this.props;
    if (!onRetryPart || this.state.retriedPart) {
      window.location.reload();
      return;
    }
    onRetryPart();
    this.setState({ failed: false, error: null, retriedPart: true });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.state.error instanceof PartLoadError) return <LoadError onRetry={this.retryPart} />;
    return <RenderError />;
  }
}
