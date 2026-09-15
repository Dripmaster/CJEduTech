export default function TalentDistribution() {
  return (
    <div className="talent-distribution">
      <h3>전체 발언 역량 분포</h3>
      <img src="/images/talent_donut_chart.png" alt="발언 역량 도넛차트" className="distribution-chart" />
      <ul>
        <li>금융이해: 80%</li> {/*더미데이터*/}
        <li>위험인식: 40%</li>
        <li>계획성: 40%</li>
        <li>실천의지: 40%</li>
      </ul>
    </div>
  );
}