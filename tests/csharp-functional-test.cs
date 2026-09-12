using System;
using System.Globalization;
using System.Text;
using System.Threading;

class Program
{
    static int Add(int a, int b)
    {
        int result = a + b;
        return result;
    }

    static void Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;

        string name = args.Length > 0 ? args[0] : "Ilias";
        int[] numbers = new int[] { 1, 2, 3, 4, 5 };
        int total = 0;

        foreach (int number in numbers)
        {
            total += number;
        }

        string status;
        switch (total)
        {
            case 15:
                status = "OK";
                break;
            default:
                status = "FAIL";
                break;
        }

        double ratio;
        try
        {
            ratio = Add(total, 15) / 3.0;
        }
        catch (Exception)
        {
            ratio = -1;
        }

        string escaped = "Line1\nLine2\t\"Q\"\\Tail";
        string literalBraces = "Braces={value}";
        string filePath = @"C:\Temp\file.txt";
        char marker = '\u0393';
        string unicodeEscape = "\u0393";

        Console.WriteLine("Name=" + name);
        Console.WriteLine("Total=" + total);
        Console.WriteLine("Status=" + status);
        Console.WriteLine("Ratio=" + ratio.ToString("0.0"));
        Console.WriteLine("Escaped=" + escaped.Replace("\n", "|").Replace("\t", ":"));
        Console.WriteLine("Literal=" + literalBraces);
        Console.WriteLine("Path=" + filePath);
        Console.WriteLine("Marker=" + marker);
        Console.WriteLine("UnicodeEscape=" + unicodeEscape);
        Console.WriteLine("Unicode=Γειά σου 👋");
    }
}
