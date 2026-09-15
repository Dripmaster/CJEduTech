export default function SubjectOverview({ totals }) {
  return (
    <div className="summary-box">
      <div className="summary-title">나의 기여</div>
      <span className="summary-item j"><i className="icon"/>+{totals['금융이해'] || 0}건</span>
      <span className="summary-item p"><i className="icon"/>+{totals['위험인식'] || 0}건</span>
      <span className="summary-item c"><i className="icon"/>+{totals['계획성'] || 0}건</span>
      <span className="summary-item r"><i className="icon"/>+{totals['실천의지'] || 0}건</span>
      <span className="summary-item lk"><i className="icon"/>+{totals.totalReactions || 0}건</span>
      <span className="summary-item ch"><i className="icon"/>+{totals.totalMessages || 0}건</span>
    </div>
  );
}