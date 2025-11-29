import CountUp from 'react-countup';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const AnimatedNumber = ({ 
  value, 
  prefix = "", 
  suffix = "", 
  decimals = 0,
  className 
}: AnimatedNumberProps) => {
  return (
    <CountUp
      start={0}
      end={value}
      duration={2.5}
      separator=","
      decimals={decimals}
      decimal="."
      prefix={prefix}
      suffix={suffix}
      className={className}
      enableScrollSpy
      scrollSpyOnce
    />
  );
};